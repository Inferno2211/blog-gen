const Queue = require('bull');
const path = require('path');

/**
 * QueueService - Manages Bull queues for article generation and backlink integration
 * Provides centralized queue management and job creation
 */
class QueueService {
    constructor() {
        const redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy: (times) => {
                // Limit retries to prevent spam
                if (times > 10) {
                    console.error('Redis connection failed after 10 attempts');
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 100, 3000);
                return delay;
            },
            reconnectOnError: (err) => {
                // Only reconnect on specific errors, not subscriber context errors
                const targetError = 'READONLY';
                if (err.message.includes(targetError)) {
                    return true;
                }
                // Ignore subscriber context errors and other transient errors
                if (err.message.includes('client|setinfo') || 
                    err.message.includes('only (P|S)SUBSCRIBE')) {
                    return false;
                }
                return false; // Don't auto-reconnect on other errors
            },
            enableOfflineQueue: true,
            connectTimeout: 10000,
            keepAlive: 30000,
            family: 4, // Force IPv4
            lazyConnect: false // Connect immediately to detect issues early
        };

        // Create separate queues for different job types
        this.articleGenerationQueue = new Queue('article-generation', {
            redis: redisConfig,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100, // Keep last 100 completed jobs
                removeOnFail: 500 // Keep last 500 failed jobs
            }
        });

        this.backlinkIntegrationQueue = new Queue('backlink-integration', {
            redis: redisConfig,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100,
                removeOnFail: 500
            }
        });

        this.scheduledPublishQueue = new Queue('scheduled-publish', {
            redis: redisConfig,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100,
                removeOnFail: 500
            }
        });

        this.expirationCheckQueue = new Queue('expiration-check', {
            redis: redisConfig,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100,
                removeOnFail: 500
            }
        });

        this._setupEventHandlers();
    }

    /**
     * Set up global event handlers for all queues
     */
    _setupEventHandlers() {
        const queues = [
            this.articleGenerationQueue,
            this.backlinkIntegrationQueue,
            this.scheduledPublishQueue,
            this.expirationCheckQueue
        ];

        queues.forEach(queue => {
            queue.on('error', (error) => {
                // Filter out subscriber context errors and connection errors
                if (error.message && (
                    error.message.includes('client|setinfo') ||
                    error.message.includes('only (P|S)SUBSCRIBE')
                )) {
                    // Silently ignore subscriber context errors - they're internal to Bull/ioredis
                    return;
                }
                
                // Filter out connection errors that are normal during reconnection
                if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                    // Silently ignore these too - no need to spam logs
                    return;
                }
                
                // Log actual errors
                console.error(`Queue ${queue.name} error:`, error);
            });

            queue.on('waiting', (jobId) => {
                console.log(`⏳ Job ${jobId} is WAITING in queue ${queue.name}`);
            });

            queue.on('delayed', (jobId, timestamp) => {
                try {
                    console.log(`⏳ Job ${jobId} is DELAYED until ${new Date(timestamp).toISOString()} in queue ${queue.name}`);
                } catch (err) {
                    console.log(`⏳ Job ${jobId} is DELAYED in queue ${queue.name}`);
                }
            });

            queue.on('active', (job) => {
                console.log(`\n🔵 Job ${job.id} is now ACTIVE in queue ${queue.name}`);
                console.log(`   Data: ${JSON.stringify(job.data, null, 2)}`);
            });

            queue.on('completed', (job, result) => {
                console.log(`\n✅ Job ${job.id} COMPLETED in queue ${queue.name}`);
                console.log(`   Result: ${JSON.stringify(result, null, 2)}\n`);
            });

                queue.on('failed', (job, err) => {
                console.error(`\n❌ Job ${job.id} FAILED in queue ${queue.name}`);
                console.error(`   Error: ${err.message}`);
                console.error(`   Stack: ${err.stack}\n`);
            });

            queue.on('stalled', (job) => {
                console.warn(`\n⚠️  Job ${job.id} STALLED in queue ${queue.name}\n`);
            });
        });
    }

    /**
     * Add article generation job to queue
     * @param {Object} jobData - { orderId, articleId, domainId, topic, niche, keyword, targetUrl, anchorText, email }
     * @returns {Promise<Object>} Bull job object
     */
    async addArticleGenerationJob(jobData) {
        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ 📥 ADDING JOB TO ARTICLE GENERATION QUEUE');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log(`║ Order ID: ${jobData.orderId}`);
        console.log(`║ Article ID: ${jobData.articleId}`);
        console.log(`║ Topic: ${jobData.topic}`);
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        const job = await this.articleGenerationQueue.add('generate-article', jobData, {
            jobId: `article-gen-${jobData.orderId}`,
            priority: jobData.priority || 10
        });

        console.log(`✅ Job ${job.id} added to queue successfully\n`);
        return job;
    }

    /**
     * Add backlink integration job to queue (also used for regeneration)
     * @param {Object} jobData - { orderId, articleId, targetUrl, anchorText, notes?, email, isRegeneration? }
     * @returns {Promise<Object>} Bull job object
     */
    async addBacklinkIntegrationJob(jobData) {
        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log(`║ 📥 ADDING ${jobData.isRegeneration ? 'REGENERATION' : 'INTEGRATION'} JOB TO BACKLINK QUEUE`);
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log(`║ Order ID: ${jobData.orderId}`);
        console.log(`║ Article ID: ${jobData.articleId}`);
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        const jobIdSuffix = jobData.isRegeneration ? `-regen-${Date.now()}` : '';
        const job = await this.backlinkIntegrationQueue.add('integrate-backlink', jobData, {
            jobId: `backlink-int-${jobData.orderId}${jobIdSuffix}`,
            priority: jobData.isRegeneration ? 5 : 10 // Higher priority for regenerations
        });

        console.log(`✅ Job ${job.id} added to queue successfully\n`);
        return job;
    }

    /**
     * Add scheduled publish job to queue
     * @param {Object} jobData - { versionId, orderId, articleId, domainName, scheduledAt }
     * @returns {Promise<Object>} Bull job object
     */
    async addScheduledPublishJob(jobData) {
        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ 📅 ADDING SCHEDULED PUBLISH JOB');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log(`║ Version ID: ${jobData.versionId}`);
        console.log(`║ Order ID: ${jobData.orderId}`);
        console.log(`║ Article ID: ${jobData.articleId}`);
        console.log(`║ Scheduled At: ${new Date(jobData.scheduledAt).toISOString()}`);
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        const delay = Math.max(0, jobData.scheduledAt - Date.now());
        const jobId = `scheduled-publish-v${jobData.versionId}`;

        const job = await this.scheduledPublishQueue.add('publish-version', jobData, {
            jobId,
            delay,
            priority: 10
        });

        console.log(`✅ Scheduled publish job ${job.id} added (delay: ${Math.round(delay / 1000)}s)\n`);
        return job;
    }

    /**
     * Cancel a scheduled publish job
     * @param {string} jobId - Job ID to cancel
     * @returns {Promise<boolean>}
     */
    async cancelScheduledPublishJob(jobId) {
        try {
            const job = await this.scheduledPublishQueue.getJob(jobId);
            if (job) {
                await job.remove();
                console.log(`✅ Cancelled scheduled publish job: ${jobId}`);
                return true;
            }
            console.log(`⚠️  Scheduled publish job not found: ${jobId}`);
            return false;
        } catch (error) {
            console.error(`❌ Error cancelling scheduled publish job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Reschedule a publish job
     * @param {string} oldJobId - Old job ID to remove
     * @param {Object} newJobData - New job data
     * @returns {Promise<Object>} New job
     */
    async reschedulePublishJob(oldJobId, newJobData) {
        await this.cancelScheduledPublishJob(oldJobId);
        return await this.addScheduledPublishJob(newJobData);
    }

    /**
     * Get job status by ID
     * @param {string} queueName - Name of the queue ('article-generation', 'backlink-integration', 'scheduled-publish')
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} Job status object
     */
    async getJobStatus(queueName, jobId) {
        const queue = this._getQueue(queueName);
        const job = await queue.getJob(jobId);

        if (!job) {
            return { exists: false };
        }

        const state = await job.getState();
        const progress = job.progress();
        const failedReason = job.failedReason;

        return {
            exists: true,
            id: job.id,
            state,
            progress,
            failedReason,
            attempts: job.attemptsMade,
            maxAttempts: job.opts.attempts,
            data: job.data,
            returnValue: job.returnvalue
        };
    }

    /**
     * Get order's job status across all queues
     * @param {string} orderId - Order ID
     * @returns {Promise<Object>} Combined job status
     */
    async getOrderJobStatus(orderId) {
        const statuses = [];

        // Check article generation jobs
        const articleGenStatus = await this.getJobStatus('article-generation', `article-gen-${orderId}`);
        if (articleGenStatus.exists) {
            statuses.push({ type: 'article-generation', ...articleGenStatus });
        }

        // Check backlink integration jobs (including regenerations with timestamps)
        const backlinkIntStatus = await this.getJobStatus('backlink-integration', `backlink-int-${orderId}`);
        if (backlinkIntStatus.exists) {
            statuses.push({ type: 'backlink-integration', ...backlinkIntStatus });
        }

        // Also check for regeneration jobs (they have timestamps in ID)
        const backlinkJobs = await this.backlinkIntegrationQueue.getJobs(['completed', 'active', 'waiting', 'failed']);
        const orderBacklinkJobs = backlinkJobs.filter(job => 
            job.data.orderId === orderId && job.id.includes('-regen-')
        );

        for (const job of orderBacklinkJobs) {
            const state = await job.getState();
            statuses.push({
                type: 'backlink-regeneration',
                id: job.id,
                state,
                progress: job.progress(),
                failedReason: job.failedReason,
                attempts: job.attemptsMade,
                data: job.data
            });
        }

        return {
            orderId,
            jobs: statuses,
            hasActiveJob: statuses.some(s => ['active', 'waiting'].includes(s.state)),
            hasFailedJob: statuses.some(s => s.state === 'failed'),
            latestJob: statuses.length > 0 ? statuses[statuses.length - 1] : null
        };
    }

    /**
     * Cancel a job
     * @param {string} queueName - Name of the queue
     * @param {string} jobId - Job ID to cancel
     */
    async cancelJob(queueName, jobId) {
        const queue = this._getQueue(queueName);
        const job = await queue.getJob(jobId);

        if (job) {
            await job.remove();
            console.log(`Job ${jobId} cancelled from queue ${queueName}`);
            return true;
        }

        return false;
    }

    /**
     * Get queue by name
     * @private
     */
    _getQueue(queueName) {
        switch (queueName) {
            case 'article-generation':
                return this.articleGenerationQueue;
            case 'backlink-integration':
                return this.backlinkIntegrationQueue;
            case 'scheduled-publish':
                return this.scheduledPublishQueue;
            default:
                throw new Error(`Unknown queue: ${queueName}`);
        }
    }

    /**
     * Get queue statistics
     * @param {string} queueName - Name of the queue
     */
    async getQueueStats(queueName) {
        const queue = this._getQueue(queueName);

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount()
        ]);

        return {
            queueName,
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed
        };
    }

    /**
     * Clean old jobs from queue
     * @param {string} queueName - Name of the queue
     * @param {number} grace - Grace period in milliseconds (default 24 hours)
     */
    async cleanQueue(queueName, grace = 24 * 60 * 60 * 1000) {
        const queue = this._getQueue(queueName);
        await queue.clean(grace, 'completed');
        await queue.clean(grace * 7, 'failed'); // Keep failed jobs for 7 days
        console.log(`Cleaned queue ${queueName}`);
    }

    /**
     * Schedule daily expiration check
     */
    async scheduleExpirationCheck() {
        // Remove existing repeatable jobs to avoid duplicates
        const jobs = await this.expirationCheckQueue.getRepeatableJobs();
        for (const job of jobs) {
            await this.expirationCheckQueue.removeRepeatableByKey(job.key);
        }

        // Add new daily job (runs every day at midnight)
        await this.expirationCheckQueue.add('check-expiration', {}, {
            repeat: { cron: '0 0 * * *' },
            jobId: 'daily-expiration-check'
        });
        
        console.log('✅ Scheduled daily expiration check');
    }

    /**
     * Check Redis connection health
     * @returns {Promise<Object>} Health status object
     */
    async checkRedisHealth() {
        try {
            // Get the underlying Redis client from the queue
            const client = await this.articleGenerationQueue.client;
            
            // Test connection with PING command
            const pingResult = await client.ping();
            
            // Get Redis server info
            const info = await client.info('server');
            const versionMatch = info.match(/redis_version:(\S+)/);
            const version = versionMatch ? versionMatch[1] : 'unknown';
            
            // Get memory usage
            const memoryInfo = await client.info('memory');
            const memoryMatch = memoryInfo.match(/used_memory_human:(\S+)/);
            const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';
            
            return {
                connected: true,
                ping: pingResult,
                version,
                memoryUsage,
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                status: 'healthy'
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                status: 'unhealthy'
            };
        }
    }

    /**
     * Close all queue connections
     */
    async close() {
        await this.articleGenerationQueue.close();
        await this.backlinkIntegrationQueue.close();
        await this.scheduledPublishQueue.close();
        await this.expirationCheckQueue.close();
        console.log('All queues closed');
    }
}

module.exports = QueueService;
