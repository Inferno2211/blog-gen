# Frontend Queue System Testing Guide

## Quick Start

### 1. Start All Services

**Terminal 1 - Redis:**
```powershell
redis-server
```

**Terminal 2 - Backend API:**
```powershell
cd backend
npm run dev
```

**Terminal 3 - Queue Worker:**
```powershell
cd backend
npm run worker:dev
```

**Terminal 4 - Frontend:**
```powershell
cd frontend/blog-order
npm run dev
```

### 2. Access the Application

- **Customer Interface:** http://localhost:5173/purchase
- **Admin Dashboard:** http://localhost:5173/login

## Test the Complete Flow

### Step-by-Step Purchase Test

1. **Browse Articles**
   - Go to `http://localhost:5173/purchase`
   - See list of available articles

2. **Initiate Purchase**
   - Click "Purchase Backlink" on any article
   - Fill in the form:
     - **Target URL:** Your website URL (e.g., `https://yoursite.com`)
     - **Anchor Text:** The clickable text (e.g., `best SEO tips`)
     - **Email:** Your email address
     - **Notes:** (Optional) Any special instructions
   - Click "Purchase Backlink"

3. **Magic Link Authentication**
   - Check your email for magic link
   - Click the link to verify
   - You'll be redirected to Stripe payment

4. **Complete Payment**
   - Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC
   - Complete payment

5. **Order Status Page (Automatic Redirect)**
   - After payment, redirected to `/order-status?order_id=...`
   - See status: **PROCESSING**
   - Watch queue status update in real-time
   - Progress bar shows job completion

6. **Content Ready (30-60 seconds)**
   - Status changes to: **QUALITY_CHECK**
   - See article preview with your backlink integrated
   - Two buttons appear:
     - 🔄 Regenerate Backlink Integration
     - ✓ Submit for Admin Review

7. **Test Regeneration (Optional)**
   - Click "Regenerate Backlink Integration"
   - Status returns to **PROCESSING**
   - Wait for completion (~30-60 seconds)
   - New version appears with backlink re-integrated
   - Can regenerate unlimited times

8. **Submit for Review**
   - When satisfied, click "Submit for Admin Review"
   - Redirected to `/review-submitted` thank you page
   - Status changes to **ADMIN_REVIEW**

9. **Admin Approval (Admin Dashboard)**
   - Login at `/login` (use admin credentials)
   - Go to `/backlink-review`
   - See pending review
   - Click "Approve"
   - Article published, customer receives email

## What to Observe

### During PROCESSING Status

- ✅ Queue status box with blue background
- ✅ Animated spinner
- ✅ Queue name (e.g., "backlink-integration")
- ✅ Job state (e.g., "active", "waiting")
- ✅ Progress bar (0-100%)
- ✅ Page polls every 5 seconds

### During QUALITY_CHECK Status

- ✅ Article preview appears
- ✅ Article title displayed
- ✅ Content excerpt visible
- ✅ "Regenerate" button enabled
- ✅ "Submit for Review" button enabled
- ✅ Regeneration count shown (if > 0)
- ✅ Polling stops

### After Regeneration

- ✅ Buttons disabled during regeneration
- ✅ "Regenerating..." loading state
- ✅ Returns to PROCESSING status
- ✅ Polling resumes
- ✅ New content appears after completion
- ✅ Regeneration count increments

### Email Notifications

- ✅ "Backlink Integrated" email received
- ✅ Email includes link to order status page
- ✅ Link format: `/order-status?order_id=...`
- ✅ Clicking link loads order status correctly

## Backend Logs to Check

### Worker Logs (Terminal 3)

```
Processing job backlink-integration:1
Fetching article for backlink integration...
Generating backlink content using AI...
QC attempt 1/3
QC passed! Creating new version...
Backlink integration completed for order abc123
```

### API Logs (Terminal 2)

```
POST /api/v1/purchase/regenerate-backlink
  Regeneration count: 1
  Adding job to queue: backlink-integration
  Job ID: 123

GET /api/v1/purchase/status/abc123
  Order status: PROCESSING
  Queue: backlink-integration
  State: active
```

## Common Test Scenarios

### Scenario: Multiple Regenerations

1. Complete purchase flow
2. At QUALITY_CHECK, click "Regenerate" (1st time)
3. Wait for completion
4. Click "Regenerate" again (2nd time)
5. Wait for completion
6. Click "Regenerate" again (3rd time)
7. Each time should:
   - Return to PROCESSING
   - Create new job
   - Generate new content
   - Increment regeneration count

### Scenario: Email Link Access

1. Complete purchase flow through PROCESSING
2. Receive "Backlink Integrated" email
3. Close browser tab
4. Click email link
5. Should land on order status page
6. See content preview and action buttons

### Scenario: Concurrent Orders

1. Open two browser windows
2. Purchase different articles in each
3. Both should process independently
4. Check worker logs to see jobs processing sequentially

## Troubleshooting

### Issue: Page shows "Loading order status..." forever

**Possible Causes:**
- Backend not running
- Wrong order ID in URL
- API endpoint error

**Fix:**
- Check backend is running on port 5000
- Verify order ID exists in database
- Check browser console for errors

### Issue: Status stuck on PROCESSING

**Possible Causes:**
- Queue worker not running
- Redis not running
- Job failed in queue

**Fix:**
- Start worker: `npm run worker:dev`
- Start Redis: `redis-server`
- Check worker logs for errors

### Issue: Regenerate button doesn't work

**Possible Causes:**
- API endpoint error
- Order not in QUALITY_CHECK status
- Missing order ID

**Fix:**
- Check backend route exists: `/api/v1/purchase/regenerate-backlink`
- Verify order status is QUALITY_CHECK
- Check browser console for API errors

### Issue: No content preview shown

**Possible Causes:**
- Backend not returning content in response
- Version not created in database

**Fix:**
- Check `getOrderStatus` endpoint response
- Verify ArticleVersion exists in database
- Check worker logs for version creation

## Browser DevTools Checks

### Network Tab

Watch for these requests:

```
GET /api/v1/purchase/status/abc123  [Every 5s during PROCESSING]
POST /api/v1/purchase/regenerate-backlink
POST /api/v1/purchase/submit-for-review
```

### Console Tab

Should see:

```
Fetching order status for: abc123
Order data updated: {order: {...}, progress: {...}}
Polling interval started
Polling interval stopped
```

### Application Tab

Check localStorage for any auth tokens or session data.

## Performance Notes

- **Polling Interval:** 5 seconds (adjustable in `OrderStatus.tsx`)
- **Typical Job Duration:** 30-60 seconds (depends on AI model speed)
- **Max Retries:** 3 attempts per job
- **Retry Delays:** 2s, 4s, 8s (exponential backoff)

## Next Steps After Testing

Once testing is successful:

1. ✅ Deploy Redis to production
2. ✅ Deploy worker process to production (PM2 config ready)
3. ✅ Update FRONTEND_URL in production .env
4. ✅ Configure SendGrid for production emails
5. ✅ Monitor queue metrics in production
6. ✅ Set up queue monitoring dashboard (optional: Bull Board)

## Related Documentation

- **Backend Queue System:** `backend/QUEUE_SYSTEM_DOCUMENTATION.md`
- **Queue Setup Guide:** `backend/QUEUE_SETUP_GUIDE.md`
- **Frontend Implementation:** `frontend/blog-order/FRONTEND_ORDER_STATUS.md`
- **Customer Flow:** `CUSTOMER_BACKLINK_FLOW.md`
- **Payment Integration:** `PAYMENT_SUCCESS_FIX.md`

---

**Ready to Test!** Follow the Quick Start steps above and work through the test scenarios. 🚀
