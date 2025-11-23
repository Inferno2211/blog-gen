# Queue System Architecture - Updated

## Overview

The blog generation platform now uses a **Bull queue system** backed by Redis for asynchronous processing of article generation and backlink integration. This ensures scalability, reliability, and better user experience.

## Key Changes from Synchronous Flow

### Before (Synchronous):
1. Customer completes payment
2. System immediately generates content (blocks for 2-5 minutes)
3. Customer waits on loading screen
4. Content shown after generation completes

### After (Queue-Based):
1. Customer completes payment  
2. Job added to queue, customer sees "Request received" message
3. Customer can close browser/do other things
4. AI processes job in background (worker process)
5. Customer receives email when ready
6. Customer clicks link to review content
7. Customer can regenerate (not edit) if unsatisfied
8. Customer submits for admin approval

## Queue Types

### 1. Article Generation Queue (`article-generation`)
- **Purpose**: Generate new articles from scratch (admin orders or customer article generation purchases)
- **Input**: `{ orderId, articleId, domainId, topic, niche, keyword, targetUrl, anchorText, email }`
- **Process**:
  1. Fetch domain info and internal link candidates
  2. Generate article content with AI
  3. Run QC checks (up to 3 attempts)
  4. Create ArticleVersion record
  5. Update order status to `QUALITY_CHECK`
  6. Send email to customer
- **Output**: New ArticleVersion with `backlink_review_status: PENDING_REVIEW`

### 2. Backlink Integration Queue (`backlink-integration`)
- **Purpose**: Integrate customer backlinks into PUBLISHED articles
- **Input**: `{ orderId, articleId, targetUrl, anchorText, notes, email, isRegeneration }`
- **Process**:
  1. Fetch the PUBLISHED article (selected_version)
  2. Generate new content with backlink integrated (AI)
  3. Run QC checks
  4. Create new ArticleVersion
  5. Update order status to `QUALITY_CHECK`
  6. Send email to customer
- **Output**: New ArticleVersion with integrated backlink
- **Important**: ALWAYS uses the published article as base, not customer's previous attempt

## Customer Flow

### Initial Purchase (Backlink Integration)

```
1. Browse articles → Select article
2. Enter backlink details (URL, anchor text, notes)
3. Enter email → Receive magic link
4. Click magic link → Redirected to Stripe
5. Complete payment → Stripe webhook fires
6. Webhook creates Order with status=PROCESSING
7. Webhook adds job to backlink-integration queue
8. Customer sees: "Request received! Check your email."
9. Worker processes job (AI integration)
10. Worker sends email: "Your backlink is ready!"
11. Customer clicks email link → Views integrated content
12. Customer options:
    a. Happy → "Submit for Review" → Admin approval
    b. Unhappy → "Regenerate" → Back to step 7 (using PUBLISHED article)
```

### Regeneration Flow (NOT Revision)

**Important**: Customers CANNOT edit or provide custom instructions. They can only regenerate the AI integration.

```
1. Customer viewing content in QUALITY_CHECK status
2. Customer clicks "Regenerate Backlink"
3. System adds NEW job to queue with isRegeneration=true
4. Order status → PROCESSING
5. Worker fetches PUBLISHED article (not previous version)
6. AI re-integrates backlink into published content
7. Creates new ArticleVersion
8. Order status → QUALITY_CHECK
9. Email sent: "Your regeneration is ready!"
10. Customer reviews new version
11. Repeat until satisfied or submit for admin approval
```

**Why no custom revisions?**
- Prevents customers from modifying article content
- Maintains article quality and editorial control
- Customers can only control: their backlink URL and anchor text
- AI handles the integration naturally into the PUBLISHED content

## Order Status Flow

```
PROCESSING → QUALITY_CHECK → ADMIN_REVIEW → COMPLETED
     ↑______________|
     (Regenerate button)
```

- **PROCESSING**: Job is queued or being processed by worker
- **QUALITY_CHECK**: Content ready, customer can review/regenerate/submit
- **ADMIN_REVIEW**: Customer submitted, awaiting admin approval
- **COMPLETED**: Admin approved and published
- **FAILED**: Job failed or admin rejected (refund initiated)

## Database Schema Updates

### Order Model
```prisma
model Order {
  id                    String      @id @default(uuid())
  session_id            String      
  article_id            String      
  version_id            String?     // Points to customer's version (updated on each regeneration)
  customer_email        String
  backlink_data         Json        // { keyword, target_url, notes }
  payment_data          Json        
  status                OrderStatus @default(PROCESSING)
  created_at            DateTime    @default(now())
  completed_at          DateTime?   
  updated_at            DateTime    @updatedAt
}
```

### ArticleVersion Model
```prisma
model ArticleVersion {
  id                     String   @id
  article_id             String
  version_num            Int
  content_md             String
  qc_attempts            Int
  last_qc_status         String?
  last_qc_notes          Json?
  backlink_review_status BacklinkReviewStatus?
  backlink_metadata      Json?    // NEW fields below
  created_at             DateTime
}
```

**backlink_metadata** structure:
```json
{
  "target_url": "https://customer-site.com",
  "anchor_text": "click here",
  "customer_notes": "Please place near intro",
  "integration_type": "customer_backlink_regeneration",
  "base_article_version_id": "uuid-of-published-version",
  "regeneration_count": 2
}
```

## API Endpoints

### POST /api/v1/purchase/webhook
**Stripe webhook** - Automatically adds job to queue after payment

```javascript
// Inside webhook handler
const job = await queueService.addBacklinkIntegrationJob({
  orderId: order.id,
  articleId: session.metadata.article_id,
  targetUrl: backlinkData.target_url,
  anchorText: backlinkData.keyword,
  notes: backlinkData.notes,
  email: order.customer_email,
  isRegeneration: false
});
```

### GET /api/v1/purchase/status/:orderId
**Get order status** with queue information

```json
{
  "status": "QUALITY_CHECK",
  "statusMessage": "Content ready for review",
  "progress": { "step": 3, "total": 5, "description": "..." },
  "version": {
    "versionId": "...",
    "content": "...",
    "qcStatus": "APPROVED_BY_AI"
  },
  "queue": {
    "hasActiveJob": false,
    "jobs": [...]
  },
  "canRegenerateBacklink": true,
  "canSubmitForReview": true
}
```

### POST /api/v1/purchase/regenerate-backlink
**Regenerate backlink integration** (uses PUBLISHED article)

```json
{
  "orderId": "uuid"
}
```

Response:
```json
{
  "success": true,
  "message": "Regeneration request submitted. You'll receive an email when ready.",
  "data": {
    "jobId": "backlink-int-uuid-regen-1234567890",
    "estimatedTime": "10-30 minutes",
    "note": "The AI will re-integrate your backlink into the current published version."
  }
}
```

### POST /api/v1/purchase/submit-for-review
**Submit for admin approval**

```json
{
  "orderId": "uuid",
  "versionId": "uuid"
}
```

## Worker Process

### Running the Worker

**Development**:
```bash
npm run worker:dev  # Auto-restart on file changes
```

**Production** (PM2):
```bash
pm2 start ecosystem.config.js
pm2 logs queue-worker
```

### Worker Architecture

```javascript
// QueueWorker.js
class QueueWorker {
  start() {
    // Process article generation (1 concurrent job)
    articleGenerationQueue.process('generate-article', 1, processArticleGeneration);
    
    // Process backlink integration (1 concurrent job)
    // Handles BOTH initial integration AND regeneration
    backlinkIntegrationQueue.process('integrate-backlink', 1, processBacklinkIntegration);
  }
}
```

### Job Processing

```javascript
// backlinkIntegrationProcessor.js
async function processBacklinkIntegration(job) {
  const { orderId, articleId, targetUrl, anchorText, isRegeneration } = job.data;
  
  // ALWAYS fetch the PUBLISHED article (selected_version)
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { selected_version: true } // This is the LIVE article
  });
  
  const publishedContent = article.selected_version.content_md;
  
  // AI integrates backlink into PUBLISHED content
  const newContent = await aiService.generateMarkdown(
    /* ...params */,
    publishedContent // Use published, not customer's previous version
  );
  
  // Create new version
  const newVersion = await prisma.articleVersion.create({
    data: {
      article_id: articleId,
      content_md: newContent,
      backlink_metadata: {
        integration_type: isRegeneration ? 'customer_backlink_regeneration' : 'customer_backlink',
        base_article_version_id: article.selected_version_id
      }
    }
  });
  
  // Update order
  await prisma.order.update({
    where: { id: orderId },
    data: { 
      version_id: newVersion.id,
      status: 'QUALITY_CHECK'
    }
  });
  
  // Send email
  await emailService.sendBacklinkIntegratedEmail(email, { orderId, ... });
}
```

## Email Notifications

### 1. Article Ready Email
- **Trigger**: Job completes successfully
- **Subject**: "Your Backlink is Ready for Review"
- **CTA**: Link to `/order-status/:orderId`
- **Content**: "Click to review your content. You can regenerate if needed."

### 2. Regeneration Ready Email  
- **Trigger**: Regeneration job completes
- **Subject**: "Your Regeneration is Ready"
- **CTA**: Link to `/order-status/:orderId`
- **Content**: "We've re-integrated your backlink. Please review the new version."

### 3. Order Failed Email
- **Trigger**: Job fails after 3 attempts
- **Subject**: "Order Processing Issue"
- **Content**: "We encountered an issue. Our team has been notified."

## Error Handling

### Job Retry Logic
- **Attempts**: 3 attempts with exponential backoff
- **Backoff**: 2s, 4s, 8s delays
- **On Final Failure**: 
  1. Order status → FAILED
  2. Send failure email to customer
  3. Admin notification (future: Slack/email)

### Recovery Strategies

**Stuck Jobs**:
```bash
redis-cli
DEL bull:backlink-integration:stalled
```

**Failed Jobs** - Retry manually:
```javascript
const job = await queueService.backlinkIntegrationQueue.getJob(jobId);
await job.retry();
```

## Frontend Integration

### Order Status Page

```typescript
// /order-status/:orderId
const OrderStatusPage = () => {
  const [order, setOrder] = useState(null);
  const [polling, setPolling] = useState(true);
  
  useEffect(() => {
    // Poll every 5 seconds while status is PROCESSING
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/purchase/status/${orderId}`);
      const data = await response.json();
      setOrder(data.data);
      
      if (data.data.status !== 'PROCESSING') {
        setPolling(false);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [orderId, order?.status]);
  
  return (
    <div>
      {order.status === 'PROCESSING' && (
        <div>
          <Spinner />
          <p>Processing your request... {order.queue.hasActiveJob ? 'AI is working' : 'In queue'}</p>
        </div>
      )}
      
      {order.status === 'QUALITY_CHECK' && (
        <div>
          <ArticlePreview content={order.version.content} />
          <button onClick={handleRegenerate}>Regenerate Backlink</button>
          <button onClick={handleSubmit}>Submit for Review</button>
        </div>
      )}
    </div>
  );
};
```

## Performance & Scalability

### Concurrency
- Current: 1 job per queue (sequential processing)
- Can increase to 2-5 for higher throughput
- Adjust in `QueueWorker.js`:
  ```javascript
  queue.process('job-type', 3, processorFunction);
  //                         ^ 3 concurrent jobs
  ```

### Rate Limiting
- API rate limits prevent abuse
- Queue naturally handles bursts
- Redis connection pooling for high load

### Monitoring
- Queue stats logged every minute
- Optional: Bull Board dashboard at `/admin/queues`
- Job retention: 100 completed, 500 failed

## Security Considerations

1. **Customer Cannot Modify Article**: Only regenerate AI integration
2. **PUBLISHED Article Always Used**: Prevents manipulation of published content
3. **Rate Limiting**: Prevent spam regeneration requests
4. **Redis Password**: Use in production
5. **Queue Authentication**: Isolate worker process

## Next Steps for Implementation

1. ✅ Queue infrastructure created
2. ✅ Worker process implemented
3. ✅ Email templates added
4. ⬜ Frontend order status page
5. ⬜ Frontend regenerate button
6. ⬜ Admin queue monitoring dashboard
7. ⬜ Automated queue cleanup job
8. ⬜ Production deployment (PM2/Docker)

---

**Key Takeaway**: Customers can regenerate the backlink integration unlimited times, but they CANNOT edit the article content. The AI always uses the PUBLISHED article as the base for integration.
