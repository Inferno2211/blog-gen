const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('./errors');

class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.prisma = new PrismaClient();
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    // Fixed pricing: $15.00 USD
    this.BACKLINK_PRICE = 1500; // in cents
    this.CURRENCY = 'usd';
  }

  /**
   * Create a Stripe checkout session for backlink purchase
   * @param {string} sessionId - Purchase session ID
   * @param {Object} sessionData - Session data including article and backlink info
   * @returns {Promise<Object>} Stripe checkout session
   */
  async createCheckoutSession(sessionId, sessionData) {
    try {
      const { article_id, backlink_data, email } = sessionData;
      
      // Create checkout session with fixed pricing
      const checkoutSession = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: this.CURRENCY,
              product_data: {
                name: 'Article Backlink Placement',
                description: `Contextual backlink placement for "${backlink_data.keyword}" in article ${article_id}`,
                metadata: {
                  article_id,
                  keyword: backlink_data.keyword,
                  target_url: backlink_data.target_url
                }
              },
              unit_amount: this.BACKLINK_PRICE,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/purchase/success?session_id={CHECKOUT_SESSION_ID}&purchase_session=${sessionId}`,
        cancel_url: `${process.env.FRONTEND_URL}/purchase/cancel?session_id=${sessionId}`,
        customer_email: email,
        metadata: {
          purchase_session_id: sessionId,
          article_id,
          keyword: backlink_data.keyword,
          target_url: backlink_data.target_url,
          notes: backlink_data.notes || ''
        },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
      });

      // Update purchase session with Stripe session ID
      await this.prisma.purchaseSession.update({
        where: { id: sessionId },
        data: {
          stripe_session_id: checkoutSession.id,
          status: 'PAYMENT_PENDING',
          updated_at: new Date()
        }
      });

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        expiresAt: checkoutSession.expires_at
      };

    } catch (error) {
      console.error('Error creating Stripe checkout session:', error);
      throw new AppError('Failed to create payment session', 500, 'STRIPE_SESSION_ERROR');
    }
  }

  /**
   * Verify and retrieve checkout session
   * @param {string} stripeSessionId - Stripe checkout session ID
   * @returns {Promise<Object>} Session verification result
   */
  async verifyCheckoutSession(stripeSessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(stripeSessionId);
      
      return {
        id: session.id,
        payment_status: session.payment_status,
        customer_email: session.customer_email,
        amount_total: session.amount_total,
        currency: session.currency,
        metadata: session.metadata,
        payment_intent: session.payment_intent
      };

    } catch (error) {
      console.error('Error verifying Stripe session:', error);
      throw new AppError('Failed to verify payment session', 500, 'STRIPE_VERIFICATION_ERROR');
    }
  }

  /**
   * Process successful payment completion
   * @param {string} stripeSessionId - Stripe checkout session ID
   * @returns {Promise<Object>} Payment processing result
   */
  async processPaymentSuccess(stripeSessionId) {
    try {
      const session = await this.verifyCheckoutSession(stripeSessionId);
      
      if (session.payment_status !== 'paid') {
        throw new AppError('Payment not completed', 400, 'PAYMENT_NOT_COMPLETED');
      }

      const purchaseSessionId = session.metadata.purchase_session_id;
      
      // Update purchase session status
      const updatedSession = await this.prisma.purchaseSession.update({
        where: { id: purchaseSessionId },
        data: {
          status: 'PAID',
          updated_at: new Date()
        }
      });

      // Create order record
      const order = await this.prisma.order.create({
        data: {
          session_id: purchaseSessionId,
          article_id: session.metadata.article_id,
          customer_email: session.customer_email,
          backlink_data: {
            keyword: session.metadata.keyword,
            target_url: session.metadata.target_url,
            notes: session.metadata.notes || null
          },
          payment_data: {
            stripe_session_id: stripeSessionId,
            amount: session.amount_total,
            currency: session.currency,
            status: 'paid',
            payment_intent: session.payment_intent
          },
          status: 'PROCESSING'
        }
      });

      return {
        orderId: order.id,
        sessionId: purchaseSessionId,
        amount: session.amount_total,
        currency: session.currency,
        status: 'PROCESSING'
      };

    } catch (error) {
      console.error('Error processing payment success:', error);
      throw new AppError('Failed to process payment completion', 500, 'PAYMENT_PROCESSING_ERROR');
    }
  }

  /**
   * Process refund for rejected backlink
   * @param {string} orderId - Order ID to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async processRefund(orderId, reason = 'Backlink rejected during review') {
    try {
      // Get order with payment data
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          session: true
        }
      });

      if (!order) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      if (order.status === 'REFUNDED') {
        throw new AppError('Order already refunded', 400, 'ALREADY_REFUNDED');
      }

      const paymentIntentId = order.payment_data.payment_intent;
      
      if (!paymentIntentId) {
        throw new AppError('No payment intent found for refund', 400, 'NO_PAYMENT_INTENT');
      }

      // Create refund in Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: order.payment_data.amount,
        reason: 'requested_by_customer',
        metadata: {
          order_id: orderId,
          refund_reason: reason,
          original_keyword: order.backlink_data.keyword,
          original_url: order.backlink_data.target_url
        }
      });

      // Update order status
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'REFUNDED',
          payment_data: {
            ...order.payment_data,
            refund_id: refund.id,
            refund_status: refund.status,
            refund_amount: refund.amount,
            refund_reason: reason
          }
        }
      });

      // Update article availability back to available
      await this.prisma.article.update({
        where: { id: order.article_id },
        data: {
          availability_status: 'AVAILABLE'
        }
      });

      return {
        refundId: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        reason: reason
      };

    } catch (error) {
      console.error('Error processing refund:', error);
      throw new AppError('Failed to process refund', 500, 'REFUND_ERROR');
    }
  }

  /**
   * Verify Stripe webhook signature
   * @param {string} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @returns {Object} Verified webhook event
   */
  verifyWebhookSignature(payload, signature) {
    try {
      if (!this.webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
      }

      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      
      // Re-throw specific configuration errors
      if (error.message === 'Stripe webhook secret not configured') {
        throw error;
      }
      
      throw new AppError('Invalid webhook signature', 400, 'WEBHOOK_VERIFICATION_ERROR');
    }
  }

  /**
   * Handle Stripe webhook events
   * @param {Object} event - Stripe webhook event
   * @returns {Promise<Object>} Event handling result
   */
  async handleWebhookEvent(event) {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          return await this.handleCheckoutCompleted(event.data.object);
        
        case 'payment_intent.succeeded':
          return await this.handlePaymentSucceeded(event.data.object);
        
        case 'payment_intent.payment_failed':
          return await this.handlePaymentFailed(event.data.object);
        
        case 'charge.dispute.created':
          return await this.handleChargeDispute(event.data.object);
        
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
          return { handled: false, type: event.type };
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw new AppError('Failed to handle webhook event', 500, 'WEBHOOK_HANDLING_ERROR');
    }
  }

  /**
   * Handle checkout session completed event
   * @param {Object} session - Stripe checkout session object
   * @returns {Promise<Object>} Handling result
   */
  async handleCheckoutCompleted(session) {
    try {
      const purchaseSessionId = session.metadata.purchase_session_id;
      
      if (!purchaseSessionId) {
        console.warn('No purchase session ID in checkout session metadata');
        return { handled: false, reason: 'No purchase session ID' };
      }

      // Process payment success
      const result = await this.processPaymentSuccess(session.id);
      
      console.log(`Checkout completed for session ${purchaseSessionId}, order ${result.orderId}`);
      
      return { 
        handled: true, 
        orderId: result.orderId,
        sessionId: purchaseSessionId 
      };

    } catch (error) {
      console.error('Error handling checkout completed:', error);
      throw error;
    }
  }

  /**
   * Handle payment succeeded event
   * @param {Object} paymentIntent - Stripe payment intent object
   * @returns {Promise<Object>} Handling result
   */
  async handlePaymentSucceeded(paymentIntent) {
    try {
      console.log(`Payment succeeded: ${paymentIntent.id}`);
      
      // Additional payment success logic can be added here
      // For now, the main processing happens in checkout.session.completed
      
      return { handled: true, paymentIntentId: paymentIntent.id };

    } catch (error) {
      console.error('Error handling payment succeeded:', error);
      throw error;
    }
  }

  /**
   * Handle payment failed event
   * @param {Object} paymentIntent - Stripe payment intent object
   * @returns {Promise<Object>} Handling result
   */
  async handlePaymentFailed(paymentIntent) {
    try {
      console.log(`Payment failed: ${paymentIntent.id}`);
      
      // Find and update related purchase session
      const order = await this.prisma.order.findFirst({
        where: {
          payment_data: {
            path: ['payment_intent'],
            equals: paymentIntent.id
          }
        }
      });

      if (order) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { status: 'FAILED' }
        });

        await this.prisma.purchaseSession.update({
          where: { id: order.session_id },
          data: { status: 'FAILED' }
        });
      }

      return { handled: true, paymentIntentId: paymentIntent.id };

    } catch (error) {
      console.error('Error handling payment failed:', error);
      throw error;
    }
  }

  /**
   * Handle charge dispute event
   * @param {Object} dispute - Stripe dispute object
   * @returns {Promise<Object>} Handling result
   */
  async handleChargeDispute(dispute) {
    try {
      console.log(`Charge dispute created: ${dispute.id}`);
      
      // Log dispute for manual review
      // Additional dispute handling logic can be added here
      
      return { handled: true, disputeId: dispute.id };

    } catch (error) {
      console.error('Error handling charge dispute:', error);
      throw error;
    }
  }

  /**
   * Get payment status for an order
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Payment status information
   */
  async getPaymentStatus(orderId) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      const stripeSessionId = order.payment_data.stripe_session_id;
      
      if (stripeSessionId) {
        const session = await this.verifyCheckoutSession(stripeSessionId);
        
        return {
          orderId,
          paymentStatus: session.payment_status,
          amount: session.amount_total,
          currency: session.currency,
          orderStatus: order.status
        };
      }

      return {
        orderId,
        paymentStatus: 'unknown',
        orderStatus: order.status
      };

    } catch (error) {
      console.error('Error getting payment status:', error);
      throw new AppError('Failed to get payment status', 500, 'PAYMENT_STATUS_ERROR');
    }
  }
}

module.exports = StripeService;