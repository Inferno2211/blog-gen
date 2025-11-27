const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { AppError } = require('./errors');
const QueueService = require('./queue/QueueService');

class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    this.prisma = new PrismaClient();
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    this.queueService = new QueueService();

    // Pricing: $15.00 USD for backlinks, $25.00 USD for article generation
    this.BACKLINK_PRICE = 1500; // in cents
    this.ARTICLE_GENERATION_PRICE = 2500; // in cents
    this.CURRENCY = 'usd';
  }

  /**
   * Create a Stripe checkout session for purchase (backlink or article generation)
   * @param {string} sessionId - Purchase session ID
   * @param {Object} sessionData - Session data including article and backlink info
   * @returns {Promise<Object>} Stripe checkout session
   */
  async createCheckoutSession(sessionId, sessionData) {
    try {
      const { article_id, backlink_data, email, type } = sessionData;
      const isArticleGeneration = type === 'article_generation';

      // Determine pricing and product details based on type
      const price = isArticleGeneration ? this.ARTICLE_GENERATION_PRICE : this.BACKLINK_PRICE;
      const productName = isArticleGeneration ? 'Custom Article Generation' : 'Article Backlink Placement';
      const description = isArticleGeneration
        ? `Custom AI-generated article for domain with title: "${backlink_data.articleTitle || 'Custom Article'}"`
        : `Contextual backlink placement for "${backlink_data.anchor_text || backlink_data.keyword}" in article ${article_id}`;

      // Create checkout session with dynamic pricing
      const checkoutSession = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: this.CURRENCY,
              product_data: {
                name: productName,
                description,
                metadata: isArticleGeneration ? {
                  type: 'article_generation',
                  domain_id: backlink_data.domainId,
                  article_title: backlink_data.articleTitle || 'Custom Article',
                  focus_keywords: backlink_data.focusKeywords || ''
                } : {
                  type: 'backlink',
                  article_id,
                  keyword: backlink_data.anchor_text || backlink_data.keyword,
                  target_url: backlink_data.target_url
                }
              },
              unit_amount: price,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment/success?stripe_session_id={CHECKOUT_SESSION_ID}&session_id=${sessionId}`,
        cancel_url: `${process.env.FRONTEND_URL}/purchase/cancel?session_id=${sessionId}`,
        customer_email: email,
        metadata: {
          purchase_session_id: sessionId,
          type: type || 'backlink',
          ...(isArticleGeneration ? {
            domain_id: backlink_data.domainId,
            article_title: backlink_data.articleTitle || 'Custom Article',
            focus_keywords: backlink_data.focusKeywords || '',
            notes: backlink_data.notes || ''
          } : {
            article_id,
            keyword: backlink_data.anchor_text || backlink_data.keyword,
            target_url: backlink_data.target_url,
            notes: backlink_data.notes || ''
          })
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

      // Handle Renewal
      if (session.metadata.type === 'renewal') {
        return await this._handleRenewalSuccess(session);
      }

      const purchaseSessionId = session.metadata.purchase_session_id;

      // Check if order already exists (idempotency check)
      const existingOrder = await this.prisma.order.findFirst({
        where: {
          session_id: purchaseSessionId,
          payment_data: {
            path: ['stripe_session_id'],
            equals: stripeSessionId
          }
        }
      });

      if (existingOrder) {
        console.log(`Order already exists for session ${purchaseSessionId}, skipping duplicate processing`);
        return {
          orderId: existingOrder.id,
          sessionId: purchaseSessionId,
          amount: session.amount_total,
          currency: session.currency,
          status: existingOrder.status,
          duplicate: true
        };
      }

      // Update purchase session status
      const updatedSession = await this.prisma.purchaseSession.update({
        where: { id: purchaseSessionId },
        data: {
          status: 'PAID',
          updated_at: new Date()
        }
      });

      // Get the purchase session to determine order type
      const purchaseSession = await this.prisma.purchaseSession.findUnique({
        where: { id: purchaseSessionId },
        include: { article: true }
      });

      if (!purchaseSession) {
        throw new AppError('Purchase session not found', 404, 'SESSION_NOT_FOUND');
      }

      // IDEMPOTENCY CHECK: If order already exists for this session, return existing order
      const existingOrderCheck = await this.prisma.order.findFirst({
        where: { session_id: purchaseSessionId }
      });

      if (existingOrderCheck) {
        console.log(`⚠️ DUPLICATE WEBHOOK: Order already exists for session ${purchaseSessionId}, returning existing order`);
        return {
          orderId: existingOrderCheck.id,
          sessionId: purchaseSessionId,
          amount: session.amount_total,
          currency: session.currency,
          status: existingOrderCheck.status
        };
      }

      // Determine if this is article generation or backlink order
      const isArticleGeneration = session.metadata.type === 'article_generation';

      // For article generation, use the article_id from the session (created during initiation)
      // For backlinks, use the article_id from metadata
      const articleId = isArticleGeneration
        ? purchaseSession.article_id
        : session.metadata.article_id;

      if (!articleId) {
        throw new AppError(`Article ID not found for ${isArticleGeneration ? 'article generation' : 'backlink'} order`, 400, 'ARTICLE_ID_MISSING');
      }

      // Prepare backlink_data based on order type
      const backlinkData = isArticleGeneration ? {
        type: 'ARTICLE_GENERATION',
        articleTitle: session.metadata.article_title || 'Custom Article',
        topic: session.metadata.focus_keywords || '',
        niche: '',
        keyword: session.metadata.focus_keywords || '',
        notes: session.metadata.notes || ''
      } : {
        keyword: session.metadata.keyword || '',
        anchor_text: session.metadata.anchor_text || session.metadata.keyword || '',
        target_url: session.metadata.target_url,
        notes: session.metadata.notes || null
      };

      // Create order record
      const order = await this.prisma.order.create({
        data: {
          session_id: purchaseSessionId,
          article_id: articleId,
          customer_email: session.customer_email,
          backlink_data: backlinkData,
          stripe_session_id: stripeSessionId, // Add direct field for idempotency
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

      // Add job to queue based on order type
      if (isArticleGeneration) {
        // Add article generation job to queue
        await this.queueService.addArticleGenerationJob({
          orderId: order.id,
          articleId: articleId,
          domainId: purchaseSession.article.domain_id,
          topic: backlinkData.articleTitle,
          niche: backlinkData.niche || '',
          keyword: backlinkData.keyword || '',
          targetUrl: backlinkData.target_url || '',
          anchorText: backlinkData.anchor_text || backlinkData.keyword || '',
          email: order.customer_email
        });
        console.log(`Article generation job added to queue for order ${order.id}`);
      } else {
        // Add backlink integration job to queue
        await this.queueService.addBacklinkIntegrationJob({
          orderId: order.id,
          articleId: articleId,
          targetUrl: backlinkData.target_url,
          anchorText: backlinkData.anchor_text || backlinkData.keyword,
          notes: backlinkData.notes,
          email: order.customer_email
        });
        console.log(`Backlink integration job added to queue for order ${order.id}`);
      }

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
          original_keyword: order.backlink_data.anchor_text || order.backlink_data.keyword,
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
   * @param {string} [secret] - Optional webhook secret to use instead of default
   * @returns {Object} Verified webhook event
   */
  verifyWebhookSignature(payload, signature, secret) {
    try {
      const webhookSecret = secret || this.webhookSecret;

      if (!webhookSecret) {
        throw new Error('Stripe webhook secret not configured');
      }

      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
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
      const orderType = session.metadata.type || 'backlink'; // Default to 'backlink' for backward compatibility

      if (!purchaseSessionId) {
        console.warn('No purchase session ID in checkout session metadata');
        return { handled: false, reason: 'No purchase session ID' };
      }

      // Check if this is a bulk purchase
      const isBulkPurchase = orderType === 'bulk_backlink';

      if (isBulkPurchase) {
        // Process bulk payment
        console.log(`Processing bulk payment for session ${purchaseSessionId}`);
        const result = await this.processBulkPaymentSuccess(session.id);
        return { handled: true, type: 'bulk_purchase', orderCount: result.orders.length };
      } else {
        // Process single article payment (existing logic)
        console.log(`Processing single payment for session ${purchaseSessionId}`);
        const result = await this.processPaymentSuccess(session.id);
        return { handled: true, type: 'single_purchase', orderId: result.orderId };
      }

    } catch (error) {
      console.error('Error handling checkout completed:', error);
      throw new AppError('Failed to handle checkout completion', 'CHECKOUT_HANDLING_ERROR');
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

  /**
   * Create bulk checkout session with multiple line items for cart
   * @param {string} sessionId - Purchase session ID
   * @param {Array<{articleId, articleTitle, domainName, backlinkData}>} cartItems - Cart items with article details
   * @param {string} email - Customer email
   * @returns {Promise<{sessionId: string, url: string, expiresAt: number}>}
   */
  async createBulkCheckoutSession(sessionId, cartItems, email) {
    try {
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new AppError('Cart items must be a non-empty array', 400, 'INVALID_CART');
      }

      if (cartItems.length > 20) {
        throw new AppError('Maximum 20 articles per purchase', 400, 'CART_TOO_LARGE');
      }

      // Create line items for each article in cart
      const lineItems = cartItems.map((item, index) => ({
        price_data: {
          currency: this.CURRENCY,
          product_data: {
            name: `Backlink Placement - ${item.articleTitle}`,
            description: `Domain: ${item.domainName} | Keyword: "${item.backlinkData.keyword}"`,
            metadata: {
              article_id: item.articleId,
              cart_index: index,
              keyword: item.backlinkData.keyword,
              target_url: item.backlinkData.target_url
            }
          },
          unit_amount: this.BACKLINK_PRICE // $15 per backlink
        },
        quantity: 1
      }));

      // Create Stripe checkout session
      const checkoutSession = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment/success?stripe_session_id={CHECKOUT_SESSION_ID}&session_id=${sessionId}`,
        cancel_url: `${process.env.FRONTEND_URL}/purchase/cancel?session_id=${sessionId}`,
        customer_email: email,
        metadata: {
          purchase_session_id: sessionId,
          cart_size: cartItems.length,
          type: 'bulk_backlink',
          article_ids: cartItems.map(item => item.articleId).join(',')
        },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
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

      console.log(`Bulk checkout session created: ${checkoutSession.id} for ${cartItems.length} articles`);

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        expiresAt: checkoutSession.expires_at
      };

    } catch (error) {
      console.error('Error creating bulk checkout session:', error);
      throw new AppError('Failed to create bulk checkout session', 500, 'BULK_CHECKOUT_ERROR');
    }
  }

  /**
   * Process bulk payment completion (webhook handler helper)
   * @param {string} stripeSessionId - Stripe checkout session ID
   * @returns {Promise<{sessionId: string, orders: Array}>}
   */
  async processBulkPaymentSuccess(stripeSessionId) {
    try {
      const session = await this.verifyCheckoutSession(stripeSessionId);

      if (session.payment_status !== 'paid') {
        throw new AppError('Payment not completed', 400, 'PAYMENT_NOT_COMPLETED');
      }

      const purchaseSessionId = session.metadata.purchase_session_id;
      const cartSize = parseInt(session.metadata.cart_size || '0');

      if (!purchaseSessionId) {
        throw new AppError('Purchase session ID not found in payment metadata', 400, 'SESSION_ID_MISSING');
      }

      // Fetch purchase session
      const purchaseSession = await this.prisma.purchaseSession.findUnique({
        where: { id: purchaseSessionId }
      });

      if (!purchaseSession) {
        throw new AppError('Purchase session not found', 404, 'SESSION_NOT_FOUND');
      }

      // IDEMPOTENCY CHECK 1: Check by Stripe session ID (more reliable for webhooks)
      const existingOrdersByStripe = await this.prisma.order.findMany({
        where: { stripe_session_id: stripeSessionId }
      });

      if (existingOrdersByStripe.length > 0) {
        console.log(`⚠️ DUPLICATE WEBHOOK: Orders already exist for Stripe session ${stripeSessionId}, returning existing orders`);
        return {
          sessionId: purchaseSessionId,
          orders: existingOrdersByStripe.map(o => ({
            orderId: o.id,
            articleId: o.article_id,
            status: o.status
          }))
        };
      }

      // IDEMPOTENCY CHECK 2: Fallback check by purchase session
      const existingOrders = await this.prisma.order.findMany({
        where: { session_id: purchaseSessionId }
      });

      if (existingOrders.length > 0) {
        console.log(`⚠️ DUPLICATE WEBHOOK: Orders already exist for session ${purchaseSessionId}, returning existing orders`);
        return {
          sessionId: purchaseSessionId,
          orders: existingOrders.map(o => ({
            orderId: o.id,
            articleId: o.article_id,
            status: o.status
          }))
        };
      }

      // Update session status to PAID
      await this.prisma.purchaseSession.update({
        where: { id: purchaseSessionId },
        data: {
          status: 'PAID',
          updated_at: new Date()
        }
      });

      // Create orders for each cart item
      const cartItems = purchaseSession.cart_items || [];
      const orders = [];

      const amountPerItem = Math.floor(session.amount_total / cartSize); // Divide total by number of items

      for (let i = 0; i < cartItems.length; i++) {
        const cartItem = cartItems[i];

        try {
          const order = await this.prisma.order.create({
            data: {
              session_id: purchaseSessionId,
              article_id: cartItem.articleId,
              customer_email: session.customer_email,
              backlink_data: cartItem.backlinkData,
              stripe_session_id: stripeSessionId, // Add direct field for idempotency
              payment_data: {
                stripe_session_id: stripeSessionId,
                amount: amountPerItem,
                currency: session.currency,
                status: 'paid',
                payment_intent: session.payment_intent,
                cart_index: i
              },
              status: 'PROCESSING'
            }
          });

          // Add backlink integration job to queue
          await this.queueService.addBacklinkIntegrationJob({
            orderId: order.id,
            articleId: cartItem.articleId,
            backlinkData: cartItem.backlinkData,
            customerEmail: session.customer_email
          });

          orders.push(order);
        } catch (orderError) {
          // Check if it's a unique constraint violation (duplicate order)
          if (orderError.code === 'P2002') {
            console.log(`⚠️ DUPLICATE ORDER: Order for article ${cartItem.articleId} already exists for Stripe session ${stripeSessionId}, skipping`);
            // Fetch existing order
            const existingOrder = await this.prisma.order.findFirst({
              where: {
                stripe_session_id: stripeSessionId,
                article_id: cartItem.articleId
              }
            });
            if (existingOrder) {
              orders.push(existingOrder);
            }
          } else {
            // Re-throw other errors
            throw orderError;
          }
        }
      }

      console.log(`Bulk payment processed: ${orders.length} orders created for session ${purchaseSessionId}`);

      return {
        sessionId: purchaseSessionId,
        orders: orders.map(o => ({
          orderId: o.id,
          articleId: o.article_id,
          status: o.status
        }))
      };

    } catch (error) {
      console.error('Error processing bulk payment:', error);
      throw new AppError('Failed to process bulk payment', 500, 'BULK_PAYMENT_PROCESSING_ERROR');
    }
  }

  /**
   * Create Stripe checkout session for article generation
   * @param {string} sessionId - Generation session ID
   * @param {Array} generationRequests - Array of article generation requests
   * @param {string} email - Customer email
   * @returns {Promise<{sessionId: string, url: string}>}
   */
  async createGenerationCheckoutSession(sessionId, generationRequests, email) {
    try {
      if (!Array.isArray(generationRequests) || generationRequests.length === 0) {
        throw new AppError('Generation requests must be a non-empty array', 400, 'INVALID_REQUESTS');
      }

      if (generationRequests.length > 20) {
        throw new AppError('Maximum 20 articles per generation request', 400, 'CART_TOO_LARGE');
      }

      // Create line items for each article generation
      const lineItems = generationRequests.map((request, index) => ({
        price_data: {
          currency: this.CURRENCY,
          product_data: {
            name: `Article Generation - ${request.topic}`,
            description: `Domain: ${request.domain?.name || 'N/A'} | Niche: ${request.niche || 'General'}`,
            metadata: {
              domain_id: request.domainId,
              topic: request.topic,
              cart_index: index
            }
          },
          unit_amount: 2500 // $25 per article
        },
        quantity: 1
      }));

      // Create Stripe checkout session
      const checkoutSession = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        // Unified success URL: reuse existing payment success page to keep front-end handling consistent.
        // Add a query param so the front-end can distinguish generation vs purchase flows.
        success_url: `${process.env.FRONTEND_URL}/payment/success?stripe_session_id={CHECKOUT_SESSION_ID}&session_id=${sessionId}&type=generation`,
        cancel_url: `${process.env.FRONTEND_URL}/generation/cancel?session_id=${sessionId}`,
        customer_email: email,
        metadata: {
          generation_session_id: sessionId,
          cart_size: generationRequests.length,
          type: 'article_generation'
        },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes
      });

      console.log(`Generation checkout session created: ${checkoutSession.id} for ${generationRequests.length} articles`);

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        expiresAt: checkoutSession.expires_at
      };

    } catch (error) {
      console.error('Error creating generation checkout session:', error);
      throw new AppError('Failed to create generation checkout session', 500, 'GENERATION_CHECKOUT_ERROR');
    }
  }

  /**
   * Create a Stripe checkout session for backlink renewal
   * @param {Object} order - The order to renew
   * @returns {Promise<Object>} Stripe checkout session
   */
  async createRenewalCheckoutSession(order) {
    try {
      const checkoutSession = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: this.CURRENCY,
              product_data: {
                name: 'Backlink Renewal',
                description: `Renew backlink for article ${order.article_id}`,
                metadata: {
                  type: 'renewal',
                  order_id: order.id,
                  article_id: order.article_id
                }
              },
              unit_amount: this.BACKLINK_PRICE,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/renewal-success?stripe_session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
        cancel_url: `${process.env.FRONTEND_URL}/renewal-cancel`,
        customer_email: order.customer_email,
        metadata: {
          type: 'renewal',
          order_id: order.id,
          article_id: order.article_id
        },
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
      });

      return {
        sessionId: checkoutSession.id,
        url: checkoutSession.url
      };
    } catch (error) {
      console.error('Stripe checkout creation failed:', error);
      throw new AppError('Failed to create payment session', 500);
    }
  }

  /**
   * Handle successful renewal payment
   * @param {Object} session - Stripe session object
   * @returns {Promise<Object>} Renewal result
   * @private
   */
  async _handleRenewalSuccess(session) {
    const orderId = session.metadata.order_id;
    const articleId = session.metadata.article_id;

    console.log(`Processing renewal for order ${orderId}`);

    // Update article expiration
    const article = await this.prisma.article.findUnique({ where: { id: articleId } });

    if (!article) {
      throw new AppError('Article not found for renewal', 404);
    }

    // Calculate new expiry date (add 30 days to current expiry or now if expired)
    let newExpiry = new Date(article.backlink_expiry_date || Date.now());
    if (newExpiry < new Date()) {
      newExpiry = new Date(); // If already expired, start from now
    }
    newExpiry.setDate(newExpiry.getDate() + 30);

    await this.prisma.article.update({
      where: { id: articleId },
      data: {
        backlink_expiry_date: newExpiry,
        availability_status: 'SOLD_OUT' // Ensure it stays sold out
      }
    });

    // Send confirmation email
    const EmailService = require('./EmailService');
    const emailService = new EmailService();
    await emailService.sendRenewalConfirmation(session.customer_email, {
      articleTitle: article.topic || article.slug,
      newExpiryDate: newExpiry
    });

    return {
      success: true,
      type: 'renewal',
      orderId,
      newExpiry
    };
  }
}

module.exports = StripeService;