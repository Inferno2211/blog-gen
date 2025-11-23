# Queue System Setup Guide

## Quick Start

### 1. Install Redis

**Windows** (using Chocolatey):
```bash
choco install redis-64
```

**macOS**:
```bash
brew install redis
```

**Linux** (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install redis-server
```

### 2. Start Redis

**Windows**:
```bash
redis-server
```

**macOS/Linux**:
```bash
redis-server
# Or as a service:
brew services start redis  # macOS
sudo systemctl start redis # Linux
```

**Verify Redis is running**:
```bash
redis-cli ping
# Should return: PONG
```

### 3. Update Environment Variables

Add these to your `.env` file:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### 4. Run the Queue Worker

**In development** (separate terminal from your API server):
```bash
cd backend
npm run worker:dev
```

**Or manually**:
```bash
cd backend
node services/queue/QueueWorker.js
```

You should see:
```
Starting queue worker...
Queue worker started successfully
Processing queues:
  - article-generation
  - backlink-integration
  - backlink-revision
```

### 5. Test the System

1. Start the backend API:
```bash
cd backend
npm start
```

2. In another terminal, start the queue worker:
```bash
cd backend
npm run worker
```

3. Make a test purchase through the frontend
4. Check the worker terminal for job processing logs
5. Check your email for notifications

## Development Workflow

### Running Locally

You need **three terminals**:

**Terminal 1 - Backend API**:
```bash
cd backend
npm run dev  # or npm start
```

**Terminal 2 - Queue Worker**:
```bash
cd backend
npm run worker:dev  # auto-restart on file changes
```

**Terminal 3 - Frontend**:
```bash
cd frontend/blog-order
npm run dev
```

### Monitoring Queue Jobs

**Check queue statistics**:
```bash
# Connect to Redis CLI
redis-cli

# List all queue keys
KEYS bull:*

# Check waiting jobs
LLEN bull:article-generation:waiting

# Check active jobs
LLEN bull:article-generation:active

# Check completed jobs
LLEN bull:article-generation:completed

# Check failed jobs
LLEN bull:article-generation:failed
```

**View job data**:
```bash
# In redis-cli
HGETALL bull:article-generation:1
```

## Production Deployment

### Using PM2

**Install PM2**:
```bash
npm install -g pm2
```

**Start with PM2**:
```bash
cd backend
pm2 start ecosystem.config.js
```

**Check status**:
```bash
pm2 list
pm2 logs blog-gen-api
pm2 logs queue-worker
```

**Save PM2 configuration**:
```bash
pm2 save
pm2 startup  # Configure to start on system boot
```

**Stop all**:
```bash
pm2 stop all
```

### Using Docker

**docker-compose.yml** (example):
```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  api:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis

  worker:
    build: ./backend
    command: node services/queue/QueueWorker.js
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis

volumes:
  redis-data:
```

**Start with Docker**:
```bash
docker-compose up -d
```

## Troubleshooting

### Worker Not Starting

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solution**: Redis is not running. Start Redis:
```bash
redis-server
```

### Jobs Not Processing

**Check if worker is running**:
```bash
ps aux | grep QueueWorker
# or with PM2:
pm2 list
```

**Restart worker**:
```bash
pm2 restart queue-worker
```

### Jobs Stuck in Waiting State

**Clear stalled jobs**:
```bash
# In redis-cli
DEL bull:article-generation:stalled
DEL bull:backlink-integration:stalled
DEL bull:backlink-revision:stalled
```

**Or programmatically**:
```javascript
const queueService = new QueueService();
await queueService.articleGenerationQueue.clean(0, 'wait');
```

### Redis Connection Issues

**Check Redis connection**:
```bash
redis-cli ping
```

**Check Redis logs** (if running as service):
```bash
# macOS
brew services list
tail -f /usr/local/var/log/redis.log

# Linux
sudo journalctl -u redis -f
```

**Restart Redis**:
```bash
# macOS
brew services restart redis

# Linux
sudo systemctl restart redis

# Windows
# Stop the redis-server process and restart it
```

### Emails Not Sending

**Check SendGrid configuration**:
```bash
# Verify environment variable
echo $SENDGRID_API_KEY
```

**Test email service**:
```javascript
// In a test script
const EmailService = require('./services/EmailService');
const emailService = new EmailService();

await emailService.sendArticleReadyEmail('test@example.com', {
  orderId: 'test-123',
  articleId: 'test-456',
  topic: 'Test Article',
  viewUrl: 'http://localhost:5173/order-status/test-123'
});
```

## Queue Management Commands

### Clean Old Jobs

**Remove completed jobs older than 24 hours**:
```javascript
const QueueService = require('./services/queue/QueueService');
const queueService = new QueueService();

// Clean all queues
await queueService.cleanQueue('article-generation', 24 * 60 * 60 * 1000);
await queueService.cleanQueue('backlink-integration', 24 * 60 * 60 * 1000);
await queueService.cleanQueue('backlink-revision', 24 * 60 * 60 * 1000);
```

### Retry Failed Job

```javascript
const jobId = 'article-gen-order-123';
const job = await queueService.articleGenerationQueue.getJob(jobId);
await job.retry();
```

### Cancel Job

```javascript
const jobId = 'backlink-int-order-456';
await queueService.cancelJob('backlink-integration', jobId);
```

### Get Queue Statistics

```javascript
const stats = await queueService.getQueueStats('article-generation');
console.log(stats);
// { waiting: 5, active: 2, completed: 150, failed: 3, delayed: 0, total: 160 }
```

## Performance Tuning

### Concurrency

**Adjust concurrent job processing** in `QueueWorker.js`:
```javascript
// Process 2 jobs simultaneously
this.queueService.articleGenerationQueue.process('generate-article', 2, async (job) => {
  return await processArticleGeneration(job);
});
```

### Rate Limiting

**Add rate limiting** to prevent API throttling:
```javascript
const limiter = {
  max: 100,      // Max 100 jobs
  duration: 60000 // per 60 seconds
};

const queue = new Queue('article-generation', {
  redis: redisConfig,
  limiter: limiter
});
```

### Memory Management

**Adjust job retention**:
```javascript
defaultJobOptions: {
  removeOnComplete: 50,  // Keep last 50 completed jobs
  removeOnFail: 200      // Keep last 200 failed jobs
}
```

## Monitoring & Logging

### Queue Dashboard

**Install Bull Board** (optional):
```bash
npm install @bull-board/express @bull-board/api
```

**Add to Express app**:
```javascript
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
const { addQueue } = createBullBoard({
  queues: [
    new BullAdapter(queueService.articleGenerationQueue),
    new BullAdapter(queueService.backlinkIntegrationQueue),
    new BullAdapter(queueService.backlinkRevisionQueue)
  ],
  serverAdapter: serverAdapter
});

serverAdapter.setBasePath('/admin/queues');
app.use('/admin/queues', serverAdapter.getRouter());
```

Access at: `http://localhost:5000/admin/queues`

### Custom Logging

**Add job progress tracking**:
```javascript
async function processArticleGeneration(job) {
  job.progress(0);
  // ... fetch data
  job.progress(25);
  // ... generate content
  job.progress(50);
  // ... run QC
  job.progress(75);
  // ... save to database
  job.progress(100);
}
```

## Security Considerations

### Redis Security

**Production Redis** should use password:
```env
REDIS_PASSWORD=your_secure_password_here
```

**Redis configuration**:
```conf
# redis.conf
requirepass your_secure_password_here
bind 127.0.0.1
protected-mode yes
```

### Rate Limiting

Add rate limiting to API endpoints to prevent abuse:
```javascript
const rateLimit = require('express-rate-limit');

const purchaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // limit each IP to 10 requests per windowMs
});

app.post('/api/v1/purchase/request-revision', purchaseLimiter, ...);
```

## Next Steps

1. ✅ Install and start Redis
2. ✅ Update .env with Redis configuration
3. ✅ Start queue worker
4. ✅ Test with a purchase order
5. ⬜ Set up PM2 for production
6. ⬜ Configure queue monitoring dashboard
7. ⬜ Set up automated queue cleanup job
8. ⬜ Configure alerts for failed jobs

## Additional Resources

- [Bull Documentation](https://github.com/OptimalBits/bull)
- [Redis Documentation](https://redis.io/documentation)
- [PM2 Documentation](https://pm2.keymetrics.io/docs)
- [Queue System Architecture](./QUEUE_SYSTEM_DOCUMENTATION.md)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review queue worker logs: `pm2 logs queue-worker`
3. Check Redis connection: `redis-cli ping`
4. Review the detailed documentation: `QUEUE_SYSTEM_DOCUMENTATION.md`
