# Queue System - Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Install Redis
brew install redis  # macOS
choco install redis-64  # Windows

# 2. Start Redis
redis-server

# 3. Start Worker (separate terminal)
cd backend
npm run worker

# 4. Start API
cd backend
npm start
```

## 📋 Required Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## 🔄 Order Status Flow

```
PROCESSING → QUALITY_CHECK → ADMIN_REVIEW → COMPLETED
               ↑_____________↓ (revisions)
```

## 📨 Email Notifications

| Event | Email Method | Sent When |
|-------|-------------|-----------|
| Article Ready | `sendArticleReadyEmail()` | Job completes, order → QUALITY_CHECK |
| Backlink Integrated | `sendBacklinkIntegratedEmail()` | Backlink added successfully |
| Revision Ready | `sendRevisionReadyEmail()` | Revision job completes |
| Order Failed | `sendOrderFailedEmail()` | Job fails after 3 retries |

## 🎯 Key API Endpoints

```
GET  /api/v1/purchase/status/:orderId
POST /api/v1/purchase/request-revision
POST /api/v1/purchase/submit-for-review
```

## 🛠️ Useful Commands

```bash
# Check Redis
redis-cli ping

# View queues
redis-cli KEYS bull:*

# Check queue length
redis-cli LLEN bull:article-generation:waiting

# Worker logs (PM2)
pm2 logs queue-worker

# Restart worker
pm2 restart queue-worker
```

## 🎨 Frontend TODO

1. Create `/order-status/:orderId` page
2. Poll order status every 10s during PROCESSING
3. Show article preview when ready
4. Add revision request form
5. Add submit for review button

## 📦 Three Queues

| Queue | Purpose | Priority |
|-------|---------|----------|
| `article-generation` | Generate new articles | 10 |
| `backlink-integration` | Add backlinks to articles | 10 |
| `backlink-revision` | Process revision requests | 5 (higher) |

## ⚡ Job Retry Logic

- **Attempts**: 3
- **Backoff**: Exponential (2s, 4s, 8s)
- **On Failure**: Order → FAILED, email customer

## 🎨 Frontend Response Structure

```typescript
interface OrderStatus {
  status: 'PROCESSING' | 'QUALITY_CHECK' | 'ADMIN_REVIEW' | 'COMPLETED' | 'FAILED';
  statusMessage: string;
  progress: { step: number; total: number; description: string };
  version?: { versionId: string; content: string; qcStatus: string };
  queue: { hasActiveJob: boolean; jobs: Job[] };
  canRequestRevision: boolean;
  canSubmitForReview: boolean;
}
```

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| Worker not starting | Check Redis: `redis-cli ping` |
| Jobs stuck in waiting | Restart worker: `pm2 restart queue-worker` |
| Emails not sending | Check `SENDGRID_API_KEY` in `.env` |
| Queue not found | Verify Redis connection in worker logs |

## 📚 Documentation Files

- `QUEUE_SYSTEM_DOCUMENTATION.md` - Full architecture
- `QUEUE_SETUP_GUIDE.md` - Setup & troubleshooting
- `IMPLEMENTATION_SUMMARY.md` - This implementation overview
- `.github/copilot-instructions.md` - Updated patterns

## 🔧 Production (PM2)

```bash
# Start
pm2 start ecosystem.config.js

# Monitor
pm2 list
pm2 monit

# Logs
pm2 logs blog-gen-api
pm2 logs queue-worker

# Restart
pm2 restart all
```

## ✅ Testing Checklist

- [ ] Redis running
- [ ] Worker started
- [ ] Make test purchase
- [ ] Check worker logs for job
- [ ] Receive email notification
- [ ] View order status
- [ ] Request revision
- [ ] Receive revision email
- [ ] Submit for review
- [ ] Admin approves

---

**Ready?** Start Redis → Start Worker → Make Purchase → Check Email!
