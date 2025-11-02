# Stripe Payment Integration

This document explains how to set up and use the Stripe payment integration for the article backlink purchase system.

## Setup

### 1. Install Dependencies

The Stripe integration requires the `stripe` npm package, which has been installed:

```bash
npm install stripe
```

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PRICE_ID=price_1234567890abcdef

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000
```

### 3. Stripe Dashboard Setup

1. Create a Stripe account and get your test API keys
2. Set up a webhook endpoint pointing to: `https://yourdomain.com/api/v1/purchase/webhook`
3. Configure the webhook to listen for these events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.dispute.created`

## API Endpoints

### Purchase Flow Endpoints

#### 1. Initiate Purchase
```
POST /api/v1/purchase/initiate
```

**Request Body:**
```json
{
  "articleId": "article-123",
  "keyword": "your anchor text",
  "targetUrl": "https://your-website.com",
  "notes": "Optional notes",
  "email": "customer@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Purchase initiated successfully. Please check your email for the magic link.",
  "data": {
    "sessionId": "session-123",
    "magicLinkSent": true
  }
}
```

#### 2. Verify Session (Magic Link)
```
POST /api/v1/purchase/verify-session
```

**Request Body:**
```json
{
  "sessionToken": "magic-link-token-from-email"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session verified successfully",
  "data": {
    "valid": true,
    "sessionData": {
      "sessionId": "session-123",
      "email": "customer@example.com",
      "articleId": "article-123",
      "backlinkData": {
        "keyword": "your anchor text",
        "target_url": "https://your-website.com",
        "notes": "Optional notes"
      }
    },
    "stripeCheckoutUrl": "https://checkout.stripe.com/pay/cs_test_...",
    "stripeSessionId": "cs_test_...",
    "expiresAt": 1234567890
  }
}
```

#### 3. Complete Payment
```
POST /api/v1/purchase/complete
```

**Request Body:**
```json
{
  "sessionId": "session-123",
  "stripeSessionId": "cs_test_..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment completed successfully. Your order is now being processed.",
  "data": {
    "orderId": "order-123",
    "status": "PROCESSING"
  }
}
```

#### 4. Get Order Status
```
GET /api/v1/purchase/status/:orderId
```

**Response:**
```json
{
  "success": true,
  "message": "Order status retrieved successfully",
  "data": {
    "status": "PROCESSING",
    "progress": {
      "step": 1,
      "total": 4,
      "description": "Processing payment and initiating backlink integration"
    },
    "estimatedCompletion": "2024-01-01T12:00:00Z",
    "orderDetails": {
      "orderId": "order-123",
      "articleTitle": "Sample Article",
      "backlinkData": {
        "keyword": "your anchor text",
        "target_url": "https://your-website.com"
      },
      "createdAt": "2024-01-01T10:00:00Z",
      "completedAt": null
    }
  }
}
```

### Webhook Endpoint

#### Stripe Webhook Handler
```
POST /api/v1/purchase/webhook
```

This endpoint handles Stripe webhook events automatically. It requires the raw request body and the `stripe-signature` header for security verification.

### Payment Status Endpoint

#### Get Payment Status
```
GET /api/v1/purchase/payment-status/:orderId
```

**Response:**
```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "orderId": "order-123",
    "paymentStatus": "paid",
    "amount": 1500,
    "currency": "usd",
    "orderStatus": "PROCESSING"
  }
}
```

## Service Classes

### StripeService

The `StripeService` class handles all Stripe-related operations:

- **createCheckoutSession()** - Creates Stripe checkout sessions
- **verifyCheckoutSession()** - Verifies payment completion
- **processPaymentSuccess()** - Processes successful payments
- **processRefund()** - Handles refunds for rejected backlinks
- **verifyWebhookSignature()** - Verifies webhook signatures
- **handleWebhookEvent()** - Processes webhook events
- **getPaymentStatus()** - Gets payment status for orders

### Integration with Existing Services

The Stripe integration works with existing services:

- **PurchaseService** - Manages the overall purchase workflow
- **EmailService** - Sends magic links and notifications
- **BacklinkService** - Integrates backlinks after payment
- **SessionService** - Manages user sessions

## Pricing

The system uses fixed pricing:
- **Price per backlink:** $15.00 USD
- **Currency:** USD only
- **Payment methods:** Credit/debit cards via Stripe

## Security Features

1. **Webhook Signature Verification** - All webhooks are verified using Stripe signatures
2. **Magic Link Authentication** - Secure email-based authentication
3. **Session Management** - Secure session tokens with expiration
4. **Input Validation** - All user inputs are validated
5. **URL Validation** - Target URLs are validated for security

## Error Handling

The integration includes comprehensive error handling:

- **Payment Failures** - Automatic retry and user notification
- **Webhook Failures** - Logged and can be replayed
- **Refund Processing** - Automatic refunds for rejected backlinks
- **Session Expiry** - Graceful handling with re-authentication

## Testing

### Unit Tests
```bash
npm test -- StripeService.test.js
```

### Integration Tests
```bash
# Set up test environment variables first
export RUN_STRIPE_INTEGRATION_TESTS=true
npm test -- StripeService.integration.test.js
```

### Manual Testing

1. Use Stripe test cards for payment testing
2. Test webhook delivery using Stripe CLI
3. Verify refund processing in Stripe dashboard

## Monitoring and Logging

All Stripe operations are logged for monitoring:

- Payment successes and failures
- Webhook events and processing
- Refund operations
- Error conditions

## Production Deployment

1. Replace test API keys with production keys
2. Update webhook endpoint URL
3. Configure proper SSL certificates
4. Set up monitoring and alerting
5. Test webhook delivery in production

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Check webhook secret configuration
   - Ensure raw body is passed to webhook handler

2. **Payment sessions expire**
   - Sessions expire after 30 minutes
   - Users need to restart the process

3. **Refunds fail**
   - Check payment intent ID exists
   - Verify refund hasn't already been processed

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

This will provide detailed error messages and stack traces.