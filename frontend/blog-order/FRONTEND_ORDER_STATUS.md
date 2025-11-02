# Frontend Order Status Implementation

## Overview

The frontend now includes a comprehensive order status page that allows customers to track their order progress in real-time, view generated content, and manage backlink regeneration.

## New Components

### OrderStatus Page (`/order-status`)

**Location:** `frontend/blog-order/src/pages/OrderStatus.tsx`

**Route:** `/order-status?order_id={orderId}`

**Features:**

1. **Real-time Progress Tracking**
   - Polls order status every 5 seconds when status is `PROCESSING`
   - Displays current stage with visual progress indicators
   - Shows queue status (queue name, state, progress percentage)
   - Automatically stops polling when processing completes

2. **Article Content Preview**
   - Shows article preview when status is `QUALITY_CHECK`
   - Displays article title and content excerpt
   - Provides full content in scrollable container

3. **Regeneration Functionality**
   - "Regenerate Backlink Integration" button visible during `QUALITY_CHECK` phase
   - Calls `POST /api/v1/purchase/regenerate-backlink` endpoint
   - Creates new job in queue with `isRegeneration: true` flag
   - Returns to `PROCESSING` status and starts polling again
   - Unlimited regenerations allowed

4. **Submit for Review**
   - "Submit for Admin Review" button visible during `QUALITY_CHECK` phase
   - Calls existing `POST /api/v1/purchase/submit-for-review` endpoint
   - Updates order status to `ADMIN_REVIEW`
   - Redirects to `/review-submitted` thank you page

5. **Status-Specific Messaging**
   - **PROCESSING:** Shows animated spinner, queue status, progress bar
   - **QUALITY_CHECK:** Shows content preview + action buttons
   - **ADMIN_REVIEW:** Purple notice indicating review in progress
   - **COMPLETED:** Green success notice with completion timestamp
   - **FAILED:** Red error notice

## Updated Services

### purchaseService.ts

**New Methods:**

```typescript
// Regenerate backlink integration (unlimited times)
export async function regenerateBacklink(orderId: string): Promise<{
  success: boolean;
  message: string;
  versionId?: string;
}>

// Get order status with queue info and content preview
export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse>
```

## Updated Types

### purchase.ts

**Updated Interface:**

```typescript
export interface OrderStatusResponse {
  order: Order;
  progress: {
    status: string;
    message: string;
    currentStage: string;
    stages: {
      name: string;
      status: 'completed' | 'in-progress' | 'pending';
      timestamp?: string;
    }[];
  };
  queueStatus?: {
    queue: string;
    state: string;
    progress?: number;
    timestamp: string;
  };
  content?: {
    contentMd: string;
    title: string;
    preview?: string;
  };
  regenerationCount?: number;
}
```

## Updated Flow

### Payment Success → Order Status

**Previous Flow:**
```
Payment Success → CustomerBacklinkConfiguration
```

**New Flow:**
```
Payment Success (3s delay) → Order Status Page
  ↓
  [PROCESSING: Shows queue status, polls every 5s]
  ↓
  [QUALITY_CHECK: Shows preview + buttons]
  ├─ Regenerate → Back to PROCESSING
  └─ Submit → ADMIN_REVIEW → Review Submitted page
```

## Email Integration

All email notifications now link to the order status page using the correct URL format:

**Format:** `${FRONTEND_URL}/order-status?order_id=${orderId}`

**Email Types Updated:**
- Article Ready Email (`sendArticleReadyEmail`)
- Backlink Integrated Email (`sendBacklinkIntegratedEmail`)
- Revision Ready Email (`sendRevisionReadyEmail`)

## Backend Changes (URL Format)

### Updated Files:

1. **backlinkIntegrationProcessor.js**
   - Changed: `viewUrl: ${FRONTEND_URL}/order-status/${orderId}`
   - To: `viewUrl: ${FRONTEND_URL}/order-status?order_id=${orderId}`

2. **articleGenerationProcessor.js**
   - Changed: `viewUrl: ${FRONTEND_URL}/order-status/${orderId}`
   - To: `viewUrl: ${FRONTEND_URL}/order-status?order_id=${orderId}`

## Testing the Frontend

### Prerequisites

1. **Backend must be running:** `cd backend && npm run dev`
2. **Queue worker must be running:** `cd backend && npm run worker:dev`
3. **Redis must be running:** `redis-server`
4. **Frontend must be running:** `cd frontend/blog-order && npm run dev`

### Test Scenarios

#### Scenario 1: Complete Purchase Flow

1. Navigate to `http://localhost:5173/purchase`
2. Click "Purchase Backlink" on an article
3. Fill in backlink details (URL, anchor text, email)
4. Click magic link in email
5. Complete Stripe payment
6. Redirected to `/order-status?order_id=...`
7. See `PROCESSING` status with queue info
8. Wait ~30-60 seconds for job to complete
9. Status changes to `QUALITY_CHECK` with content preview
10. Click "Regenerate" to test regeneration (optional)
11. Click "Submit for Review" to finalize

#### Scenario 2: Email Link Click

1. Receive "Backlink Integrated" email
2. Click "Review Your Backlink" button
3. Should land on `/order-status?order_id=...`
4. See content preview and action buttons

#### Scenario 3: Regeneration

1. On order status page with `QUALITY_CHECK` status
2. Click "Regenerate Backlink Integration"
3. Status returns to `PROCESSING`
4. Queue polling starts again
5. Wait for completion
6. New content appears (regenerated with published article as base)
7. Can regenerate again unlimited times

### What to Check

- ✅ Progress stages update correctly
- ✅ Queue status shows real-time info
- ✅ Polling stops when not `PROCESSING`
- ✅ Content preview displays properly
- ✅ Regenerate button works (adds job to queue)
- ✅ Submit button works (redirects to review submitted)
- ✅ Regeneration count increments
- ✅ Email links work correctly
- ✅ Error messages display properly
- ✅ Loading states show during API calls

## UI/UX Features

### Visual Feedback

- **Loading Spinners:** During regeneration and submission
- **Progress Indicators:** Checkmarks for completed stages, pulsing dot for in-progress
- **Status Badges:** Color-coded by status (green = completed, blue = quality check, yellow = processing, purple = admin review, red = failed)
- **Progress Bar:** Shows job progress percentage when available
- **Animations:** Smooth transitions, pulsing effects for active jobs

### Responsive Design

- Mobile-friendly layout
- Buttons stack vertically on small screens
- Scrollable content preview with max height
- Readable font sizes and spacing

### User Guidance

- Clear instructions at each stage
- Help text explaining regeneration vs. submission
- Backlink details always visible
- Timestamps for all completed stages
- Regeneration count indicator

## Common Issues & Debugging

### Issue: Polling doesn't stop

**Cause:** Order status not updating to `QUALITY_CHECK`

**Solution:** Check backend logs, verify worker is processing jobs

### Issue: Content doesn't appear

**Cause:** Backend not returning `content` object in response

**Solution:** Verify `getOrderStatus` endpoint returns content when status is `QUALITY_CHECK`

### Issue: Regenerate button doesn't work

**Cause:** Missing orderId or API endpoint error

**Solution:** Check browser console for errors, verify orderId is in URL, check backend route exists

### Issue: Email link doesn't work

**Cause:** URL format mismatch

**Solution:** Verify `FRONTEND_URL` env variable is correct, check email template uses `?order_id=` format

## Future Enhancements

### Potential Additions:

1. **WebSocket Integration:** Replace polling with real-time WebSocket updates
2. **Full Content View Modal:** Show full markdown content in expandable modal
3. **Regeneration History:** Show list of all regeneration attempts
4. **Live Preview:** Render markdown with syntax highlighting
5. **Estimated Completion Time:** Show ETA based on queue position
6. **Download Content:** Button to download markdown file
7. **Share Link:** Generate shareable preview link

## Environment Variables

Ensure these are set in `frontend/blog-order/.env`:

```env
VITE_REACT_APP_API_URL=http://localhost:5000
VITE_REACT_APP_API_VERSION=1
```

Backend `.env` should have:

```env
FRONTEND_URL=http://localhost:5173
```

---

**Last Updated:** October 19, 2025  
**Related Docs:** QUEUE_SYSTEM_DOCUMENTATION.md, CUSTOMER_BACKLINK_FLOW.md, PAYMENT_SUCCESS_FIX.md
