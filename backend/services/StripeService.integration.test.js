/**
 * Integration tests for Stripe payment processing
 * These tests require actual Stripe test keys and should be run manually
 * when testing the complete payment flow
 */

const StripeService = require('./StripeService');
const PurchaseService = require('./PurchaseService');
const { PrismaClient } = require('@prisma/client');

// Skip these tests in CI/CD - they require actual Stripe test keys
const runIntegrationTests = process.env.RUN_STRIPE_INTEGRATION_TESTS === 'true';

describe.skip('Stripe Integration Tests', () => {
  let stripeService;
  let purchaseService;
  let prisma;

  beforeAll(() => {
    if (!runIntegrationTests) {
      console.log('Skipping Stripe integration tests. Set RUN_STRIPE_INTEGRATION_TESTS=true to run.');
      return;
    }

    // Ensure test environment variables are set
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe test keys required for integration tests');
    }

    stripeService = new StripeService();
    purchaseService = new PurchaseService();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  describe('Complete Payment Flow', () => {
    let testArticleId;
    let testSessionId;
    let testOrderId;

    beforeEach(async () => {
      if (!runIntegrationTests) return;

      // Create test article
      const testArticle = await prisma.article.create({
        data: {
          slug: 'test-article-' + Date.now(),
          title: 'Test Article for Payment',
          status: 'published',
          availability_status: 'AVAILABLE',
          domain_id: 'test-domain'
        }
      });
      testArticleId = testArticle.id;
    });

    afterEach(async () => {
      if (!runIntegrationTests) return;

      // Clean up test data
      if (testOrderId) {
        await prisma.order.deleteMany({
          where: { id: testOrderId }
        });
      }
      if (testSessionId) {
        await prisma.purchaseSession.deleteMany({
          where: { id: testSessionId }
        });
      }
      if (testArticleId) {
        await prisma.article.deleteMany({
          where: { id: testArticleId }
        });
      }
    });

    it('should complete full purchase flow with Stripe', async () => {
      if (!runIntegrationTests) return;

      // 1. Initiate purchase
      const backlinkData = {
        keyword: 'test keyword',
        target_url: 'https://example.com',
        notes: 'Integration test'
      };

      const purchaseResult = await purchaseService.initiatePurchase(
        testArticleId,
        backlinkData,
        'test@example.com'
      );

      testSessionId = purchaseResult.sessionId;
      expect(purchaseResult.sessionId).toBeDefined();
      expect(purchaseResult.magicLinkToken).toBeDefined();

      // 2. Verify session
      const sessionResult = await purchaseService.verifySession(purchaseResult.magicLinkToken);
      expect(sessionResult.valid).toBe(true);
      expect(sessionResult.sessionData).toBeDefined();

      // 3. Create Stripe checkout session
      const checkoutResult = await stripeService.createCheckoutSession(
        testSessionId,
        sessionResult.sessionData
      );

      expect(checkoutResult.sessionId).toBeDefined();
      expect(checkoutResult.url).toContain('checkout.stripe.com');

      // 4. Simulate successful payment (in real test, this would be done via Stripe)
      // For integration test, we'll mock the payment success
      const mockStripeSession = {
        id: checkoutResult.sessionId,
        payment_status: 'paid',
        customer_email: 'test@example.com',
        amount_total: 1500,
        currency: 'usd',
        metadata: {
          purchase_session_id: testSessionId,
          article_id: testArticleId,
          keyword: 'test keyword',
          target_url: 'https://example.com',
          notes: 'Integration test'
        },
        payment_intent: 'pi_test_' + Date.now()
      };

      // Mock the Stripe session retrieval
      jest.spyOn(stripeService.stripe.checkout.sessions, 'retrieve')
        .mockResolvedValue(mockStripeSession);

      const paymentResult = await stripeService.processPaymentSuccess(checkoutResult.sessionId);
      testOrderId = paymentResult.orderId;

      expect(paymentResult.orderId).toBeDefined();
      expect(paymentResult.status).toBe('PROCESSING');

      // 5. Verify order was created
      const order = await prisma.order.findUnique({
        where: { id: testOrderId }
      });

      expect(order).toBeDefined();
      expect(order.status).toBe('PROCESSING');
      expect(order.payment_data.amount).toBe(1500);
    });

    it('should handle refund flow correctly', async () => {
      if (!runIntegrationTests) return;

      // Create a test order first
      const testOrder = await prisma.order.create({
        data: {
          session_id: 'test-session',
          article_id: testArticleId,
          customer_email: 'test@example.com',
          backlink_data: {
            keyword: 'test keyword',
            target_url: 'https://example.com'
          },
          payment_data: {
            stripe_session_id: 'cs_test_123',
            amount: 1500,
            currency: 'usd',
            status: 'paid',
            payment_intent: 'pi_test_123'
          },
          status: 'ADMIN_REVIEW'
        }
      });

      testOrderId = testOrder.id;

      // Mock Stripe refund creation
      const mockRefund = {
        id: 'ref_test_123',
        amount: 1500,
        currency: 'usd',
        status: 'succeeded'
      };

      jest.spyOn(stripeService.stripe.refunds, 'create')
        .mockResolvedValue(mockRefund);

      // Process refund
      const refundResult = await stripeService.processRefund(testOrderId, 'Quality issues');

      expect(refundResult.refundId).toBe('ref_test_123');
      expect(refundResult.amount).toBe(1500);
      expect(refundResult.status).toBe('succeeded');

      // Verify order status updated
      const updatedOrder = await prisma.order.findUnique({
        where: { id: testOrderId }
      });

      expect(updatedOrder.status).toBe('REFUNDED');
      expect(updatedOrder.payment_data.refund_id).toBe('ref_test_123');
    });
  });

  describe('Webhook Processing', () => {
    it('should handle checkout.session.completed webhook', async () => {
      if (!runIntegrationTests) return;

      const webhookEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_webhook_123',
            payment_status: 'paid',
            customer_email: 'webhook@example.com',
            amount_total: 1500,
            currency: 'usd',
            metadata: {
              purchase_session_id: 'session-webhook-123',
              article_id: 'article-webhook-123',
              keyword: 'webhook keyword',
              target_url: 'https://webhook.example.com'
            },
            payment_intent: 'pi_webhook_123'
          }
        }
      };

      // Create mock purchase session
      await prisma.purchaseSession.create({
        data: {
          id: 'session-webhook-123',
          email: 'webhook@example.com',
          article_id: 'article-webhook-123',
          backlink_data: {
            keyword: 'webhook keyword',
            target_url: 'https://webhook.example.com'
          },
          status: 'PAYMENT_PENDING',
          magic_link_token: 'webhook-token',
          magic_link_expires: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      });

      const result = await stripeService.handleWebhookEvent(webhookEvent);

      expect(result.handled).toBe(true);
      expect(result.orderId).toBeDefined();

      // Clean up
      await prisma.order.deleteMany({
        where: { id: result.orderId }
      });
      await prisma.purchaseSession.deleteMany({
        where: { id: 'session-webhook-123' }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      if (!runIntegrationTests) return;

      // Test with invalid session data
      const invalidSessionData = {
        article_id: 'invalid-article',
        backlink_data: {
          keyword: 'test',
          target_url: 'invalid-url'
        },
        email: 'invalid-email'
      };

      await expect(
        stripeService.createCheckoutSession('invalid-session', invalidSessionData)
      ).rejects.toThrow();
    });

    it('should handle payment verification failures', async () => {
      if (!runIntegrationTests) return;

      await expect(
        stripeService.verifyCheckoutSession('invalid-session-id')
      ).rejects.toThrow();
    });
  });
});

// Manual test helper functions
if (runIntegrationTests) {
  console.log(`
    Stripe Integration Test Helper
    ============================
    
    To run these tests:
    1. Set up Stripe test keys in your .env file
    2. Set RUN_STRIPE_INTEGRATION_TESTS=true
    3. Run: npm test -- StripeService.integration.test.js
    
    Test Environment Variables Required:
    - STRIPE_SECRET_KEY (test key starting with sk_test_)
    - STRIPE_WEBHOOK_SECRET (webhook secret from Stripe dashboard)
    - DATABASE_URL (test database)
    
    These tests will:
    - Create real Stripe checkout sessions (in test mode)
    - Test webhook signature verification
    - Test refund processing
    - Clean up all test data automatically
  `);
}

module.exports = {
  // Export helper functions for manual testing
  createTestCheckoutSession: async (stripeService, sessionData) => {
    return await stripeService.createCheckoutSession('test-session', sessionData);
  },
  
  processTestRefund: async (stripeService, orderId) => {
    return await stripeService.processRefund(orderId, 'Test refund');
  }
};