const QueueService = require('./QueueService');
const processArticleGeneration = require('./processors/articleGenerationProcessor');
const processBacklinkIntegration = require('./processors/backlinkIntegrationProcessor');

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

        console.log('✅ Queue processors registered\n');
        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ ✅ QUEUE WORKER RUNNING');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log('║ Processing queues:');
        console.log('║   • article-generation');
        console.log('║   • backlink-integration');
        console.log('║');
        console.log('║ Waiting for jobs...');
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        // Set up graceful shutdown
        this._setupGracefulShutdown();

        // Log queue stats periodically
        this._startStatsLogger();
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
