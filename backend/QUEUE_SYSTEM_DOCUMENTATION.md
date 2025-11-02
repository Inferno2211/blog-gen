# Queue-Based Article Generation & Backlink Integration System

## Overview

This system uses **Bull** (backed by Redis) to handle article generation, backlink integration, and revision requests asynchronously. When customers make purchases, their requests are added to queues and processed in the background. Customers receive email notifications when their content is ready for review.

## Architecture

### Queue Types

1. **article-generation**: Generates new articles from scratch (article generation orders)
2. **backlink-integration**: Integrates customer backlinks into existing articles
3. **backlink-revision**: Processes customer revision requests

### Flow Diagram

```
Customer Payment → Add Job to Queue → Process in Background → Email Customer → Customer Reviews → Request Revision or Submit
```

## Workflow Steps

### 1. Customer Purchase (After Payment)

**Previous Flow** (Synchronous):
- Payment completed
- Article/backlink generated immediately (blocking)
- Customer waited for processing
- No way to track progress

**New Flow** (Asynchronous):
- Payment completed via Stripe webhook
- Job added to appropriate queue
- Customer immediately receives confirmation
- Background worker processes job
- Customer receives email when ready
- Customer can check order status anytime

### 2. Order Status Tracking

Customers can check their order status at any time:

**GET** `/api/v1/purchase/status/:orderId`

Response includes:
- Current order status (PROCESSING, QUALITY_CHECK, ADMIN_REVIEW, COMPLETED, FAILED)
- Progress information (step X of 5)
- Queue job status (waiting, active, completed, failed)
- Article content (when ready)
- Ability to request revisions or submit for review

### 3. Customer Review & Revision

When order reaches `QUALITY_CHECK` status:

**Customer can:**
- View the generated article/integrated backlink
- Request unlimited revisions with specific feedback
- Submit for final admin approval

**Request Revision:**
```
POST /api/v1/purchase/request-revision
Body: {
  orderId: "uuid",
  revisionNotes: "Please make the introduction more engaging..."
}
```

This adds a new job to the `backlink-revision` queue with higher priority.

### 4. Email Notifications

Customers receive emails at key points:

1. **Article Ready**: `sendArticleReadyEmail()` - New article generated
2. **Backlink Integrated**: `sendBacklinkIntegratedEmail()` - Backlink added to article
3. **Revision Ready**: `sendRevisionReadyEmail()` - Revision completed
4. **Order Failed**: `sendOrderFailedEmail()` - Processing error occurred

Each email contains a link to view the order status page.

## Job Processors

### Article Generation Processor
**File**: `services/queue/processors/articleGenerationProcessor.js`

**Steps:**
1. Update order status to PROCESSING
2. Fetch domain and internal link candidates
3. Generate article content with AI
4. Run quality check (QC) with up to 3 retry attempts
5. Create ArticleVersion with backlink metadata
6. Update order status to QUALITY_CHECK
7. Send email notification to customer

**Job Data:**
```javascript
{
  orderId,
  articleId,
  domainId,
  topic,
  niche,
  keyword,
  targetUrl,
  anchorText,
  email
}
```

### Backlink Integration Processor
**File**: `services/queue/processors/backlinkIntegrationProcessor.js`

**Steps:**
1. Update order status to PROCESSING
2. Fetch existing article content
3. Generate new version with customer backlink integrated
4. Run QC with retry logic
5. Create new ArticleVersion
6. Update order status to QUALITY_CHECK
7. Send email notification

**Job Data:**
```javascript
{
  orderId,
  articleId,
  versionId, // optional - previous version
  targetUrl,
  anchorText,
  notes,
  email
}
```

### Backlink Revision Processor
**File**: `services/queue/processors/backlinkRevisionProcessor.js`

**Steps:**
1. Fetch current order and version
2. Generate revised content based on customer feedback
3. Run QC with retry logic
4. Create new ArticleVersion with revision notes
5. Update order status to QUALITY_CHECK
6. Send email notification

**Job Data:**
```javascript
{
  orderId,
  versionId,
  revisionNotes,
  email
}
```

## Queue Worker

**File**: `services/queue/QueueWorker.js`

The worker is a separate process that continuously processes jobs from all queues.

**Starting the Worker:**
```bash
# In development (separate terminal)
cd backend
node services/queue/QueueWorker.js

# In production (with PM2)
pm2 start services/queue/QueueWorker.js --name queue-worker
```

**Features:**
- Graceful shutdown on SIGTERM/SIGINT
- Automatic retry with exponential backoff (3 attempts)
- Queue statistics logging every minute
- Error handling and job failure tracking

## Database Schema Updates

### Order Status Flow

```
PROCESSING → QUALITY_CHECK → ADMIN_REVIEW → COMPLETED
                  ↓
                FAILED (with refund)
```

**New Fields Used:**
- `Order.status`: Tracks progression through workflow
- `ArticleVersion.backlink_metadata`: Stores original backlink data, revision notes
- `ArticleVersion.backlink_review_status`: PENDING_REVIEW, APPROVED, REJECTED

## Redis Setup

**Install Redis:**
```bash
# Windows (using Chocolatey)
choco install redis-64

# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server
```

**Start Redis:**
```bash
# Windows
redis-server

# macOS/Linux
redis-server /usr/local/etc/redis.conf
```

**Environment Variables:**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD= # Leave empty for no password
```

## Queue Management

### Check Queue Status

**Get Queue Statistics:**
```javascript
const queueService = new QueueService();
const stats = await queueService.getQueueStats('article-generation');
// Returns: { waiting, active, completed, failed, delayed, total }
```

### Monitor Order Jobs

**Get Order Job Status:**
```javascript
const queueService = new QueueService();
const status = await queueService.getOrderJobStatus(orderId);
// Returns: { orderId, jobs, hasActiveJob, hasFailedJob, latestJob }
```

### Clean Old Jobs

**Remove Completed Jobs:**
```javascript
// Clean jobs older than 24 hours
await queueService.cleanQueue('article-generation', 24 * 60 * 60 * 1000);
```

## Error Handling

### Job Failures

Jobs automatically retry 3 times with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: After 2 seconds
- Attempt 3: After 4 seconds
- After 3 failures: Job marked as failed

**On Final Failure:**
1. Order status updated to FAILED
2. Customer receives failure email
3. Admin notified (future enhancement)
4. Job remains in Redis for 7 days for debugging

### Queue Recovery

**Stuck Jobs:**
Jobs are marked as "stalled" if they don't complete within the timeout. Bull automatically retries stalled jobs.

**Redis Connection Loss:**
Queue worker handles connection errors gracefully and attempts to reconnect.

## Frontend Integration

### Order Status Page

**Route**: `/order-status/:orderId`

**Features:**
- Real-time order status display
- Progress indicator (step X of 5)
- Queue job status visualization
- Article preview when ready
- Revision request form
- Submit for review button

**Example Component Structure:**
```jsx
<OrderStatusPage>
  <ProgressIndicator status={order.status} />
  
  {order.status === 'PROCESSING' && (
    <QueueStatus jobs={order.queue.jobs} />
  )}
  
  {order.status === 'QUALITY_CHECK' && (
    <>
      <ArticlePreview content={order.version.content} />
      <RevisionRequestForm onSubmit={handleRevision} />
      <SubmitForReviewButton onClick={handleSubmit} />
    </>
  )}
  
  {order.status === 'ADMIN_REVIEW' && (
    <WaitingForApproval />
  )}
  
  {order.status === 'COMPLETED' && (
    <CompletedMessage articleUrl={liveArticleUrl} />
  )}
</OrderStatusPage>
```

### Polling for Updates

**Option 1: Manual Refresh**
Customer clicks "Refresh Status" button to check progress.

**Option 2: Auto-Polling** (Recommended)
```javascript
useEffect(() => {
  if (order.status === 'PROCESSING') {
    const interval = setInterval(() => {
      fetchOrderStatus(orderId);
    }, 10000); // Poll every 10 seconds
    
    return () => clearInterval(interval);
  }
}, [order.status]);
```

**Option 3: WebSockets** (Future Enhancement)
Real-time updates when job completes.

## Testing

### Test Queue Processing

```bash
# 1. Start Redis
redis-server

# 2. Start queue worker
node services/queue/QueueWorker.js

# 3. In another terminal, start backend
cd backend
npm start

# 4. Make a test purchase and check job processing
```

### Monitor Redis

```bash
# Connect to Redis CLI
redis-cli

# Check queue keys
KEYS bull:*

# View job data
HGETALL bull:article-generation:1

# Check queue status
LLEN bull:article-generation:waiting
LLEN bull:article-generation:active
LLEN bull:article-generation:completed
LLEN bull:article-generation:failed
```

## Production Deployment

### Process Management with PM2

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'queue-worker',
      script: 'services/queue/QueueWorker.js',
      instances: 1, // Only one worker needed
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

**Start:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Redis Configuration

**Production Redis** (secured):
```env
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your_secure_password
```

Consider using managed Redis services:
- AWS ElastiCache
- Redis Cloud
- Azure Cache for Redis
- Google Cloud Memorystore

### Monitoring

**Queue Dashboard** (Optional):
Install Bull Board for visual queue monitoring:

```bash
npm install @bull-board/express
```

Access at: `http://localhost:5000/admin/queues`

## Migration Guide

### Migrating from Synchronous to Queue-Based

**⚠️ Breaking Changes:**
1. Content no longer generated immediately after payment
2. Frontend must handle PROCESSING status and polling
3. Customers receive emails instead of immediate results

**Migration Steps:**

1. **Update Database Schema:**
```bash
npx prisma migrate dev --name add_queue_support
```

2. **Install Dependencies:**
```bash
npm install bull redis
```

3. **Set Up Redis:**
Follow Redis setup instructions above.

4. **Update Frontend:**
- Replace synchronous processing expectations
- Add order status polling
- Implement revision request UI
- Handle email link clicks

5. **Deploy Queue Worker:**
Ensure worker is running alongside API server.

6. **Test End-to-End:**
Complete a full purchase flow and verify emails.

## Troubleshooting

### Jobs Not Processing

**Check Worker Status:**
```bash
ps aux | grep QueueWorker
pm2 list
```

**Check Redis Connection:**
```bash
redis-cli ping
# Should return: PONG
```

**Check Queue Stats:**
```javascript
const stats = await queueService.getQueueStats('article-generation');
console.log(stats);
```

### Jobs Failing Repeatedly

**View Failed Job Details:**
```javascript
const job = await queueService.articleGenerationQueue.getJob(jobId);
console.log(job.failedReason);
console.log(job.stacktrace);
```

**Retry Failed Job:**
```javascript
await job.retry();
```

### Emails Not Sending

**Check EmailService:**
- Verify SendGrid API key
- Check SendGrid logs
- Verify email templates

**Test Email:**
```javascript
const emailService = new EmailService();
await emailService.sendArticleReadyEmail('test@example.com', {
  orderId: 'test-123',
  articleId: 'test-456',
  topic: 'Test Article',
  viewUrl: 'http://localhost:5173/order-status/test-123'
});
```

## Future Enhancements

1. **WebSocket Support**: Real-time job status updates
2. **Priority Queue**: VIP customers get faster processing
3. **Batch Processing**: Generate multiple articles at once
4. **Scheduled Jobs**: Delay publishing to specific date/time
5. **Queue Analytics**: Track processing times, success rates
6. **Admin Dashboard**: View and manage all queue jobs
7. **Retry Logic**: Smart retry with different AI models
8. **Cost Tracking**: Monitor AI API usage per job

## API Reference

### Queue Endpoints

**Get Order Status:**
```
GET /api/v1/purchase/status/:orderId
Response: { status, progress, queue, version, canRequestRevision }
```

**Request Revision:**
```
POST /api/v1/purchase/request-revision
Body: { orderId, revisionNotes }
Response: { jobId, estimatedTime }
```

**Submit for Review:**
```
POST /api/v1/purchase/submit-for-review
Body: { orderId, versionId }
Response: { reviewId }
```

## Conclusion

The queue-based system provides:
- ✅ **Scalability**: Handle hundreds of concurrent orders
- ✅ **Reliability**: Automatic retries and error recovery
- ✅ **User Experience**: Clear status tracking and email notifications
- ✅ **Flexibility**: Unlimited revisions without blocking
- ✅ **Monitoring**: Full visibility into job processing
- ✅ **Decoupling**: API server and job processing separated

For questions or issues, consult the troubleshooting section or check queue logs.
