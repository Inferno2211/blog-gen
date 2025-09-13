const StripeService = require('./StripeService');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('./errors');

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn()
      }
    },
    refunds: {
      create: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    purchaseSession: {
      update: jest.fn(),
      findUnique: jest.fn()
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    article: {
      update: jest.fn()
    }
  }))
}));

describe('StripeService', () => {
  let stripeService;
  let mockStripe;
  let mockPrisma;

  beforeEach(() => {
    // Set required environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    stripeService = new StripeService();
    mockStripe = stripeService.stripe;
    mockPrisma = stripeService.prisma;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.FRONTEND_URL;
  });

  describe('constructor', () => {
    it('should throw error if STRIPE_SECRET_KEY is not set', () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(() => new StripeService()).toThrow('STRIPE_SECRET_KEY environment variable is required');
    });

    it('should initialize with correct pricing', () => {
      expect(stripeService.BACKLINK_PRICE).toBe(1500);
      expect(stripeService.CURRENCY).toBe('usd');
    });
  });

  describe('createCheckoutSession', () => {
    const mockSessionData = {
      article_id: 'article-123',
      backlink_data: {
        keyword: 'test keyword',
        target_url: 'https://example.com',
        notes: 'test notes'
      },
      email: 'test@example.com'
    };

    it('should create checkout session successfully', async () => {
      const mockCheckoutSession = {
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
        expires_at: Math.floor(Date.now() / 1000) + 1800
      };

      mockStripe.checkout.sessions.create.mockResolvedValue(mockCheckoutSession);
      mockPrisma.purchaseSession.update.mockResolvedValue({});

      const result = await stripeService.createCheckoutSession('session-123', mockSessionData);

      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Article Backlink Placement',
              description: 'Contextual backlink placement for "test keyword" in article article-123',
              metadata: {
                article_id: 'article-123',
                keyword: 'test keyword',
                target_url: 'https://example.com'
              }
            },
            unit_amount: 1500,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: 'http://localhost:3000/purchase/success?session_id={CHECKOUT_SESSION_ID}&purchase_session=session-123',
        cancel_url: 'http://localhost:3000/purchase/cancel?session_id=session-123',
        customer_email: 'test@example.com',
        metadata: {
          purchase_session_id: 'session-123',
          article_id: 'article-123',
          keyword: 'test keyword',
          target_url: 'https://example.com',
          notes: 'test notes'
        },
        expires_at: expect.any(Number)
      });

      expect(mockPrisma.purchaseSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          stripe_session_id: 'cs_test_123',
          status: 'PAYMENT_PENDING',
          updated_at: expect.any(Date)
        }
      });

      expect(result).toEqual({
        sessionId: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
        expiresAt: mockCheckoutSession.expires_at
      });
    });

    it('should handle Stripe API errors', async () => {
      mockStripe.checkout.sessions.create.mockRejectedValue(new Error('Stripe API error'));

      await expect(stripeService.createCheckoutSession('session-123', mockSessionData))
        .rejects.toThrow(AppError);
    });
  });

  describe('verifyCheckoutSession', () => {
    it('should verify checkout session successfully', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'paid',
        customer_email: 'test@example.com',
        amount_total: 1500,
        currency: 'usd',
        metadata: { purchase_session_id: 'session-123' },
        payment_intent: 'pi_test_123'
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await stripeService.verifyCheckoutSession('cs_test_123');

      expect(mockStripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_123');
      expect(result).toEqual({
        id: 'cs_test_123',
        payment_status: 'paid',
        customer_email: 'test@example.com',
        amount_total: 1500,
        currency: 'usd',
        metadata: { purchase_session_id: 'session-123' },
        payment_intent: 'pi_test_123'
      });
    });

    it('should handle verification errors', async () => {
      mockStripe.checkout.sessions.retrieve.mockRejectedValue(new Error('Session not found'));

      await expect(stripeService.verifyCheckoutSession('invalid-session'))
        .rejects.toThrow(AppError);
    });
  });

  describe('processPaymentSuccess', () => {
    it('should process payment success successfully', async () => {
      const mockSession = {
        id: 'cs_test_123',
        payment_status: 'paid',
        customer_email: 'test@example.com',
        amount_total: 1500,
        currency: 'usd',
        metadata: {
          purchase_session_id: 'session-123',
          article_id: 'article-123',
          keyword: 'test keyword',
          target_url: 'https://example.com',
          notes: 'test notes'
        },
        payment_intent: 'pi_test_123'
      };

      const mockOrder = {
        id: 'order-123',
        session_id: 'session-123',
        article_id: 'article-123',
        status: 'PROCESSING'
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);
      mockPrisma.purchaseSession.update.mockResolvedValue({});
      mockPrisma.order.create.mockResolvedValue(mockOrder);

      const result = await stripeService.processPaymentSuccess('cs_test_123');

      expect(mockPrisma.purchaseSession.update).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        data: {
          status: 'PAID',
          updated_at: expect.any(Date)
        }
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: {
          session_id: 'session-123',
          article_id: 'article-123',
          customer_email: 'test@example.com',
          backlink_data: {
            keyword: 'test keyword',
            target_url: 'https://example.com',
            notes: 'test notes'
          },
          payment_data: {
            stripe_session_id: 'cs_test_123',
            amount: 1500,
            currency: 'usd',
            status: 'paid',
            payment_intent: 'pi_test_123'
          },
          status: 'PROCESSING'
        }
      });

      expect(result).toEqual({
        orderId: 'order-123',
        sessionId: 'session-123',
        amount: 1500,
        currency: 'usd',
        status: 'PROCESSING'
      });
    });

    it('should throw error if payment not completed', async () => {
      const mockSession = {
        payment_status: 'unpaid',
        metadata: { purchase_session_id: 'session-123' }
      };

      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      await expect(stripeService.processPaymentSuccess('cs_test_123'))
        .rejects.toThrow(AppError);
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        article_id: 'article-123',
        status: 'ADMIN_REVIEW',
        payment_data: {
          payment_intent: 'pi_test_123',
          amount: 1500
        },
        backlink_data: {
          keyword: 'test keyword',
          target_url: 'https://example.com'
        },
        session: {}
      };

      const mockRefund = {
        id: 'ref_test_123',
        amount: 1500,
        currency: 'usd',
        status: 'succeeded'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockStripe.refunds.create.mockResolvedValue(mockRefund);
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.article.update.mockResolvedValue({});

      const result = await stripeService.processRefund('order-123', 'Quality issues');

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test_123',
        amount: 1500,
        reason: 'requested_by_customer',
        metadata: {
          order_id: 'order-123',
          refund_reason: 'Quality issues',
          original_keyword: 'test keyword',
          original_url: 'https://example.com'
        }
      });

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          status: 'REFUNDED',
          payment_data: {
            payment_intent: 'pi_test_123',
            amount: 1500,
            refund_id: 'ref_test_123',
            refund_status: 'succeeded',
            refund_amount: 1500,
            refund_reason: 'Quality issues'
          }
        }
      });

      expect(result).toEqual({
        refundId: 'ref_test_123',
        amount: 1500,
        currency: 'usd',
        status: 'succeeded',
        reason: 'Quality issues'
      });
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(stripeService.processRefund('invalid-order'))
        .rejects.toThrow(AppError);
    });

    it('should throw error if order already refunded', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'REFUNDED'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(stripeService.processRefund('order-123'))
        .rejects.toThrow(AppError);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify webhook signature successfully', () => {
      const mockEvent = { type: 'checkout.session.completed' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = stripeService.verifyWebhookSignature('payload', 'signature');

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_test_123'
      );
      expect(result).toEqual(mockEvent);
    });

    it('should throw error for invalid signature', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => stripeService.verifyWebhookSignature('payload', 'invalid'))
        .toThrow(AppError);
    });

    it('should throw error if webhook secret not configured', () => {
      stripeService.webhookSecret = null;

      expect(() => stripeService.verifyWebhookSignature('payload', 'signature'))
        .toThrow('Stripe webhook secret not configured');
    });
  });

  describe('handleWebhookEvent', () => {
    it('should handle checkout.session.completed event', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            metadata: { purchase_session_id: 'session-123' }
          }
        }
      };

      // Mock the processPaymentSuccess method
      jest.spyOn(stripeService, 'processPaymentSuccess').mockResolvedValue({
        orderId: 'order-123',
        sessionId: 'session-123'
      });

      const result = await stripeService.handleWebhookEvent(mockEvent);

      expect(stripeService.processPaymentSuccess).toHaveBeenCalledWith('cs_test_123');
      expect(result).toEqual({
        handled: true,
        orderId: 'order-123',
        sessionId: 'session-123'
      });
    });

    it('should handle payment_intent.succeeded event', async () => {
      const mockEvent = {
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_test_123' }
        }
      };

      const result = await stripeService.handleWebhookEvent(mockEvent);

      expect(result).toEqual({
        handled: true,
        paymentIntentId: 'pi_test_123'
      });
    });

    it('should handle unrecognized event types', async () => {
      const mockEvent = {
        type: 'unknown.event',
        data: { object: {} }
      };

      const result = await stripeService.handleWebhookEvent(mockEvent);

      expect(result).toEqual({
        handled: false,
        type: 'unknown.event'
      });
    });
  });

  describe('getPaymentStatus', () => {
    it('should get payment status successfully', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'PROCESSING',
        payment_data: {
          stripe_session_id: 'cs_test_123'
        }
      };

      const mockSession = {
        payment_status: 'paid',
        amount_total: 1500,
        currency: 'usd'
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockStripe.checkout.sessions.retrieve.mockResolvedValue(mockSession);

      const result = await stripeService.getPaymentStatus('order-123');

      expect(result).toEqual({
        orderId: 'order-123',
        paymentStatus: 'paid',
        amount: 1500,
        currency: 'usd',
        orderStatus: 'PROCESSING'
      });
    });

    it('should handle order without Stripe session', async () => {
      const mockOrder = {
        id: 'order-123',
        status: 'PROCESSING',
        payment_data: {}
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await stripeService.getPaymentStatus('order-123');

      expect(result).toEqual({
        orderId: 'order-123',
        paymentStatus: 'unknown',
        orderStatus: 'PROCESSING'
      });
    });

    it('should throw error if order not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(stripeService.getPaymentStatus('invalid-order'))
        .rejects.toThrow(AppError);
    });
  });
});