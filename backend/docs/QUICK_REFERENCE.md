# Queue System - Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Install Redis
choco install redis-64  # Windows
brew install redis      # macOS

# 2. Start Redis
redis-server

# 3. Update .env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 4. Install dependencies
cd backend
npm install

# 5. Run worker (separate terminal)
npm run worker:dev

# 6. Run API server
npm run dev
```

## 📋 Key Concepts

### Regeneration vs. Revision

**Regeneration (What We Built)**:
- Customer clicks "Regenerate"
- System uses PUBLISHED article as base
- AI re-integrates backlink naturally
- Customer CANNOT edit article content

**Revision (What We Did NOT Build)**:
- Customer provides custom edit instructions
- Customer can modify article content
- Requires editorial review workflow

### Order Status Flow

```
PROCESSING → QUALITY_CHECK → ADMIN_REVIEW → COMPLETED
     ↑______________|
     (Regenerate button - uses PUBLISHED article)
```

## 🔧 Common Commands

### Development

```bash
# Terminal 1 - API
cd backend && npm run dev

# Terminal 2 - Worker  
cd backend && npm run worker:dev

# Terminal 3 - Frontend
cd frontend/blog-order && npm run dev
```

### Production (PM2)

```bash
cd backend
pm2 start ecosystem.config.js
pm2 logs queue-worker
pm2 restart all
```

### Redis Monitoring

```bash
# Connect to Redis
redis-cli

# Check job counts
LLEN bull:backlink-integration:waiting
LLEN bull:backlink-integration:active
LLEN bull:backlink-integration:completed
LLEN bull:backlink-integration:failed

# Clear stalled jobs
DEL bull:backlink-integration:stalled
```

## 📡 API Endpoints

### POST /api/v1/purchase/regenerate-backlink
```json
Request:  { "orderId": "uuid" }
Response: { "jobId": "...", "estimatedTime": "10-30 minutes" }
```

### GET /api/v1/purchase/status/:orderId
```json
Response: {
  "status": "QUALITY_CHECK",
  "version": { "content": "...", ... },
  "queue": { "hasActiveJob": false, "jobs": [...] },
  "canRegenerateBacklink": true
}
```

## 🔍 Troubleshooting

| Problem | Solution |
|---------|----------|
| Worker not starting | Check Redis: `redis-cli ping` |
| Jobs stuck in waiting | Clear stalled: `DEL bull:*:stalled` |
| Emails not sending | Verify `SENDGRID_API_KEY` in .env |
| Job failed | Retry: `job.retry()` in Redis CLI |

## 📁 File Structure

```
backend/
├── services/
│   └── queue/
│       ├── QueueService.js          # Queue manager
│       ├── QueueWorker.js           # Worker process
│       └── processors/
│           ├── articleGenerationProcessor.js
│           └── backlinkIntegrationProcessor.js
├── ecosystem.config.js              # PM2 config
└── package.json                     # worker scripts
```

## 🎯 Key Points to Remember

1. ✅ Always start Redis before worker
2. ✅ Worker runs in separate process from API
3. ✅ Customers regenerate (not revise) content
4. ✅ PUBLISHED article is always the base for regeneration
5. ✅ Email notifications sent automatically
6. ✅ Jobs retry 3 times on failure

## 📚 Documentation Files

- `QUEUE_SETUP_GUIDE.md` - Complete setup instructions
- `QUEUE_SYSTEM_ARCHITECTURE.md` - Detailed technical architecture
- `QUEUE_IMPLEMENTATION_SUMMARY.md` - Implementation overview
- `QUICK_REFERENCE.md` - This file

## 💡 Testing Checklist

- [ ] Redis running (`redis-cli ping`)
- [ ] Worker running (`pm2 list` or check terminal)
- [ ] API server running (`http://localhost:5000`)
- [ ] Frontend running (`http://localhost:5173`)
- [ ] Make test purchase
- [ ] Check worker logs for job processing
- [ ] Verify email received
- [ ] Test regenerate button
- [ ] Test submit for review

## 🆘 Need Help?

1. Check worker logs: `pm2 logs queue-worker`
2. Check Redis: `redis-cli` → `KEYS bull:*`
3. Review setup guide: `QUEUE_SETUP_GUIDE.md`
4. Check architecture docs: `QUEUE_SYSTEM_ARCHITECTURE.md`

---

**Remember**: Customers can regenerate unlimited times, but they CANNOT edit the article content. The PUBLISHED article is always the source of truth.
