const QueueService = require('./QueueService');
const processArticleGeneration = require('./processors/articleGenerationProcessor');
const processBacklinkIntegration = require('./processors/backlinkIntegrationProcessor');
const processScheduledPublish = require('./processors/scheduledPublishProcessor');
const processExpirationCheck = require('./processors/expirationProcessor');

/**
 * Queue Worker - Processes jobs from all queues
 * This should be run as a separate process or service
 */
class QueueWorker {
    constructor() {
        this.queueService = new QueueService();
        this.isShuttingDown = false;
    }

    /**
     * Start processing all queues
     */
    async start() {
        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ 🔄 QUEUE WORKER STARTING');
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        // Set up error handlers for connection issues
        this._setupErrorHandlers();

        // Set up processors for each queue
        console.log('📋 Registering queue processors...');
        
        this.queueService.articleGenerationQueue.process('generate-article', 1, async (job) => {
            console.log(`\n🎯 Picked up job from article-generation queue: ${job.id}`);
            return await processArticleGeneration(job);
        });

        this.queueService.backlinkIntegrationQueue.process('integrate-backlink', 1, async (job) => {
            console.log(`\n🎯 Picked up job from backlink-integration queue: ${job.id}`);
            return await processBacklinkIntegration(job);
        });

        this.queueService.scheduledPublishQueue.process('publish-version', 1, async (job) => {
            console.log(`\n🎯 Picked up job from scheduled-publish queue: ${job.id}`);
            return await processScheduledPublish(job);
        });

        this.queueService.expirationCheckQueue.process('check-expiration', 1, async (job) => {
            console.log(`\n🎯 Picked up job from expiration-check queue: ${job.id}`);
            return await processExpirationCheck(job);
        });

        console.log('✅ Queue processors registered\n');

        // Reconcile scheduled jobs after startup
        await this._reconcileScheduledJobs();

        // Schedule expiration check
        await this.queueService.scheduleExpirationCheck();

        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ ✅ QUEUE WORKER RUNNING');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log('║ Processing queues:');
        console.log('║   • article-generation');
        console.log('║   • backlink-integration');
        console.log('║   • scheduled-publish');
        console.log('║   • expiration-check');
        console.log('║');
        console.log('║ Waiting for jobs...');
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        // Set up graceful shutdown
        this._setupGracefulShutdown();

        // Log queue stats periodically
        this._startStatsLogger();
    }

    /**
     * Reconcile scheduled jobs from database
     * Re-creates missing jobs after Redis restart
     * @private
     */
    async _reconcileScheduledJobs() {
        console.log('\n╔═══════════════════════════════════════════════════════════════');
        console.log('║ 🔄 RECONCILING SCHEDULED PUBLISH JOBS');
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        try {
            const prisma = require('../../db/prisma');
            
            // Find all scheduled versions
            const scheduledVersions = await prisma.articleVersion.findMany({
                where: {
                    scheduled_status: 'SCHEDULED',
                    scheduled_publish_at: {
                        not: null
                    }
                },
                include: {
                    article: {
                        include: {
                            domain: true
                        }
                    },
                    orders: {
                        where: {
                            version_id: { not: null }
                        },
                        take: 1
                    }
                }
            });

            console.log(`Found ${scheduledVersions.length} scheduled versions in database\n`);

            let reconciledCount = 0;
            let skippedCount = 0;

            for (const version of scheduledVersions) {
                const scheduledAt = new Date(version.scheduled_publish_at).getTime();
                const now = Date.now();
                const jobId = `scheduled-publish-v${version.id}`;
                // Load primary order for this version (if any)
                const order = version.orders && version.orders.length > 0 ? version.orders[0] : null;

                // Check if job exists in queue
                const existingJob = await this.queueService.scheduledPublishQueue.getJob(jobId);

                if (existingJob) {
                    let state = 'unknown';
                    try {
                        state = await existingJob.getState();
                    } catch (err) {
                        state = 'unavailable';
                    }
                    console.log(`✓ Job ${jobId} already exists in queue (state: ${state})`);

                    // If the job is in a terminal state (completed/failed/stalled), we should remove and recreate it
                    // to handle cases where the job was cancelled or completed without publishing
                    if (['completed', 'failed', 'stalled'].includes(state)) {
                        const delay = Math.max(0, scheduledAt - Date.now());
                        console.log(`🔁 Job ${jobId} is in terminal state (${state}). Recreating (delay ${Math.round(delay/1000)}s)`);
                        try {
                            await existingJob.remove();
                            await this.queueService.addScheduledPublishJob({
                                versionId: version.id,
                                orderId: order.id,
                                articleId: version.article_id,
                                domainName: version.article.domain?.slug || 'unknown',
                                scheduledAt
                            });
                            // Update job id if missing
                            if (!version.scheduled_job_id) {
                                await prisma.articleVersion.update({ where: { id: version.id }, data: { scheduled_job_id: jobId } });
                            }
                            reconciledCount++;
                            continue;
                        } catch (recreateErr) {
                            console.error(`Failed to recreate job ${jobId}:`, recreateErr);
                            continue;
                        }
                    }

                    skippedCount++;
                    continue;
                }

                // Re-create missing job
                console.log(`🔧 Re-creating missing job ${jobId} (scheduled: ${new Date(scheduledAt).toISOString()})`);

                if (!order) {
                    console.warn(`⚠️  No order found for version ${version.id}, skipping`);
                    continue;
                }

                const jobData = {
                    versionId: version.id,
                    orderId: order.id,
                    articleId: version.article_id,
                    domainName: version.article.domain?.slug || 'unknown',
                    scheduledAt
                };

                // Add job with computed delay (or immediate if overdue)
                await this.queueService.addScheduledPublishJob(jobData);

                // Update job ID if it was missing
                if (!version.scheduled_job_id) {
                    await prisma.articleVersion.update({
                        where: { id: version.id },
                        data: { scheduled_job_id: jobId }
                    });
                }

                reconciledCount++;
            }

            console.log('\n╔═══════════════════════════════════════════════════════════════');
            console.log('║ ✅ RECONCILIATION COMPLETE');
            console.log('╠═══════════════════════════════════════════════════════════════');
            console.log(`║ Re-created: ${reconciledCount}`);
            console.log(`║ Already exists: ${skippedCount}`);
            console.log(`║ Total: ${scheduledVersions.length}`);
            console.log('╚═══════════════════════════════════════════════════════════════\n');

        } catch (error) {
            console.error('❌ Reconciliation failed:', error);
            // Don't throw - allow worker to start even if reconciliation fails
        }
    }

    /**
     * Set up error handlers for queues
     * @private
     */
    _setupErrorHandlers() {
        const handleError = (queueName, error) => {
            // Ignore ECONNRESET errors - they're expected when clients close connections
            if (error.code === 'ECONNRESET' || error.errno === -4077) {
                console.log(`Queue ${queueName} info: Client closed connection (this is normal)`);
                return;
            }
            // Log other errors
            console.error(`Queue ${queueName} error:`, error);
        };

        this.queueService.articleGenerationQueue.on('error', (error) => {
            handleError('article-generation', error);
        });

        this.queueService.backlinkIntegrationQueue.on('error', (error) => {
            handleError('backlink-integration', error);
        });

        // Also handle failed jobs separately
        this.queueService.articleGenerationQueue.on('failed', (job, err) => {
            console.error(`Job ${job.id} in article-generation failed:`, err.message);
        });

        this.queueService.backlinkIntegrationQueue.on('failed', (job, err) => {
            console.error(`Job ${job.id} in backlink-integration failed:`, err.message);
        });
    }

    /**
     * Stop processing queues gracefully
     */
    async stop() {
        if (this.isShuttingDown) {
            console.log('Already shutting down...');
            return;
        }

        this.isShuttingDown = true;
        console.log('Stopping queue worker...');

        // Stop stats logger
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }

        // Wait for active jobs to complete
        await this.queueService.articleGenerationQueue.pause(true, true);
        await this.queueService.backlinkIntegrationQueue.pause(true, true);

        // Close connections
        await this.queueService.close();

        console.log('Queue worker stopped');
    }

    /**
     * Set up graceful shutdown handlers
     * @private
     */
    _setupGracefulShutdown() {
        const shutdownHandler = async (signal) => {
            console.log(`\nReceived ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
        process.on('SIGINT', () => shutdownHandler('SIGINT'));

        // Handle uncaught errors
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught exception:', error);
            await this.stop();
            process.exit(1);
        });

        process.on('unhandledRejection', async (reason, promise) => {
            console.error('Unhandled rejection at:', promise, 'reason:', reason);
            await this.stop();
            process.exit(1);
        });
    }

    /**
     * Start logging queue statistics periodically
     * @private
     */
    _startStatsLogger() {
        this.statsInterval = setInterval(async () => {
            try {
                const articleGenStats = await this.queueService.getQueueStats('article-generation');
                const backlinkIntStats = await this.queueService.getQueueStats('backlink-integration');

                console.log('\n=== Queue Statistics ===');
                console.log('Article Generation:', articleGenStats);
                console.log('Backlink Integration:', backlinkIntStats);
                console.log('=====================\n');
            } catch (error) {
                console.error('Failed to get queue stats:', error);
            }
        }, 60000); // Log every minute
    }
}

// If this file is run directly, start the worker
if (require.main === module) {
    const worker = new QueueWorker();
    worker.start().catch((error) => {
        console.error('Failed to start queue worker:', error);
        process.exit(1);
    });
}

module.exports = QueueWorker;
