const PurchaseService = require('../../../services/PurchaseService');
const SessionService = require('../../../services/SessionService');
const EmailService = require('../../../services/EmailService');
const StripeService = require('../../../services/StripeService');
const QueueService = require('../../../services/queue/QueueService');
const { ValidationError, NotFoundError, ConflictError } = require('../../../services/errors');
const prisma = require('../../../db/prisma');

/**
 * Purchase Controller - Handles API endpoints for the article backlink purchase system
 * Manages order initiation, session verification, payment completion, and order tracking
 */
class PurchaseController {
    constructor() {
        this.purchaseService = new PurchaseService();
        this.sessionService = new SessionService();
        this.emailService = new EmailService();
        this.stripeService = new StripeService();
        this.queueService = new QueueService();
    }

    /**
     * POST /api/v1/purchase/initiate
     * Initiate a new purchase order and send magic link
     */
    async initiatePurchase(req, res, next) {
        try {
            const { articleId, keyword, targetUrl, notes, email } = req.body;

            // Validate required fields
            if (!articleId) {
                throw new ValidationError('Article ID is required');
            }
            if (!keyword) {
                throw new ValidationError('Keyword (anchor text) is required');
            }
            if (!targetUrl) {
                throw new ValidationError('Target URL is required');
            }
            if (!email) {
                throw new ValidationError('Email is required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new ValidationError('Invalid email format');
            }

            // Validate URL format
            try {
                new URL(targetUrl);
            } catch {
                throw new ValidationError('Invalid target URL format');
            }

            // Prepare backlink data
            const backlinkData = {
                keyword: keyword.trim(),
                target_url: targetUrl.trim(),
                notes: notes ? notes.trim() : undefined
            };

            // Initiate purchase
            const result = await this.purchaseService.initiatePurchase(
                articleId,
                backlinkData,
                email
            );

            // Send magic link email
            let magicLinkSent = false;
            let emailError = null;
            
            try {
                await this.emailService.sendMagicLink(
                    email,
                    result.magicLinkToken,
                    {
                        sessionId: result.sessionId,
                        articleId: articleId,
                        keyword: keyword
                    }
                );
                magicLinkSent = true;
            } catch (error) {
                console.error('Failed to send magic link email:', error);
                emailError = error.message;
                magicLinkSent = false;
            }

            // Return appropriate response based on email delivery status
            if (magicLinkSent) {
                res.status(200).json({
                    success: true,
                    message: 'Purchase initiated successfully. Please check your email for the magic link.',
                    data: {
                        sessionId: result.sessionId,
                        magicLinkSent: true
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Purchase session created but failed to send magic link email. Please try again.',
                    error: 'Email delivery failed',
                    data: {
                        sessionId: result.sessionId,
                        magicLinkSent: false,
                        emailError: emailError
                    }
                });
            }

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/verify-session
     * Verify magic link token and authenticate session
     */
    async verifySession(req, res, next) {
        try {
            const { sessionToken } = req.body;

            if (!sessionToken) {
                throw new ValidationError('Session token is required');
            }

            // Verify session using PurchaseService
            const result = await this.purchaseService.verifySession(sessionToken);

            if (!result.valid) {
                return res.status(400).json({
                    success: false,
                    message: result.error || 'Invalid session token',
                    data: {
                        valid: false
                    }
                });
            }

            // Check if session is already paid - if so, get order details and redirect to configuration
            const session = await prisma.purchaseSession.findUnique({
                where: { magic_link_token: sessionToken },
                include: {
                    orders: {
                        orderBy: { created_at: 'desc' },
                        take: 1
                    }
                }
            });

            if (session && session.status === 'PAID') {
                // Session is already paid, return order details for redirect to configuration
                const order = session.orders[0];
                if (order) {
                    const isArticleGeneration = result.sessionData.backlink_data?.type === 'ARTICLE_GENERATION';
                    
                    return res.status(200).json({
                        success: true,
                        message: 'Session already paid - redirect to configuration',
                        data: {
                            valid: true,
                            sessionData: result.sessionData,
                            alreadyPaid: true,
                            orderId: order.id,
                            orderType: isArticleGeneration ? 'article_generation' : 'backlink',
                            redirectUrl: `/configure-${isArticleGeneration ? 'article' : 'backlink'}?order_id=${order.id}`
                        }
                    });
                }
            }

            // Create Stripe checkout session for unpaid sessions
            const sessionDataWithType = {
                ...result.sessionData,
                type: result.sessionData.backlink_data?.type === 'ARTICLE_GENERATION' ? 'article_generation' : 'backlink'
            };
            
            const checkoutSession = await this.stripeService.createCheckoutSession(
                result.sessionData.sessionId,
                sessionDataWithType
            );

            res.status(200).json({
                success: true,
                message: 'Session verified successfully',
                data: {
                    valid: true,
                    sessionData: result.sessionData,
                    stripeCheckoutUrl: checkoutSession.url,
                    stripeSessionId: checkoutSession.sessionId,
                    expiresAt: checkoutSession.expiresAt
                }
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/complete
     * Complete payment and initiate backlink processing
     */
    async completePayment(req, res, next) {
        try {
            const { sessionId, stripeSessionId } = req.body;

            if (!sessionId) {
                throw new ValidationError('Session ID is required');
            }
            if (!stripeSessionId) {
                throw new ValidationError('Stripe session ID is required');
            }

            // Process payment success through Stripe
            const paymentResult = await this.stripeService.processPaymentSuccess(stripeSessionId);
            
            // Complete purchase processing
            const result = await this.purchaseService.completePayment(sessionId, stripeSessionId);

            // Send order confirmation email
            try {
                const orderStatus = await this.purchaseService.getOrderStatus(result.orderId);
                await this.emailService.sendOrderConfirmation(
                    orderStatus.orderDetails.customerEmail,
                    {
                        id: result.orderId,
                        articleTitle: orderStatus.orderDetails.articleTitle,
                        backlink_data: orderStatus.orderDetails.backlinkData, // Convert camelCase to snake_case
                        status: result.status,
                        created_at: orderStatus.orderDetails.createdAt
                    }
                );
            } catch (emailError) {
                console.error('Failed to send order confirmation email:', emailError);
                // Continue with response even if email fails
            }

            res.status(200).json({
                success: true,
                message: 'Payment completed successfully. Your order is now being processed.',
                data: {
                    orderId: result.orderId,
                    status: result.status
                }
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/purchase/status/:orderId
     * Get order status and progress information (with queue status)
     */
    async getOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }

            // Get order details
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    article: {
                        include: {
                            domain: true
                        }
                    },
                    version: true,
                    session: true
                }
            });

            if (!order) {
                throw new NotFoundError('Order not found');
            }

            // Get queue status for this order
            const queueStatus = await this.queueService.getOrderJobStatus(orderId);

            // Determine overall status message
            let statusMessage = 'Unknown status';
            let progress = { step: 1, total: 5, description: 'Initializing...' };

            switch (order.status) {
                case 'PROCESSING':
                    statusMessage = 'Processing your request';
                    progress = { 
                        step: 2, 
                        total: 5, 
                        description: queueStatus.hasActiveJob 
                            ? 'AI is generating your content...' 
                            : 'Request queued, processing will begin shortly...'
                    };
                    break;
                case 'QUALITY_CHECK':
                    statusMessage = 'Content ready for review';
                    progress = { 
                        step: 3, 
                        total: 5, 
                        description: 'Your content is ready! Please review and request revisions if needed.'
                    };
                    break;
                case 'ADMIN_REVIEW':
                    statusMessage = 'Submitted for final approval';
                    progress = { 
                        step: 4, 
                        total: 5, 
                        description: 'Our team is reviewing your content for final approval...'
                    };
                    break;
                case 'COMPLETED':
                    statusMessage = 'Order completed';
                    progress = { 
                        step: 5, 
                        total: 5, 
                        description: 'Your article has been published!'
                    };
                    break;
                case 'FAILED':
                    statusMessage = 'Order processing failed';
                    progress = { 
                        step: 0, 
                        total: 5, 
                        description: 'An error occurred. Please contact support.'
                    };
                    break;
            }

            res.status(200).json({
                success: true,
                message: 'Order status retrieved successfully',
                data: {
                    status: order.status,
                    statusMessage,
                    progress,
                    orderDetails: {
                        orderId: order.id,
                        articleId: order.article_id,
                        articleSlug: order.article?.slug,
                        domainName: order.article?.domain?.name,
                        backlinkData: order.backlink_data,
                        createdAt: order.created_at,
                        completedAt: order.completed_at,
                        customerEmail: order.customer_email
                    },
                    version: order.version ? {
                        versionId: order.version_id,
                        versionNum: order.version.version_num,
                        content: order.version.content_md,
                        qcStatus: order.version.last_qc_status,
                        backlinkReviewStatus: order.version.backlink_review_status
                    } : null,
                    queue: {
                        hasActiveJob: queueStatus.hasActiveJob,
                        hasFailedJob: queueStatus.hasFailedJob,
                        jobs: queueStatus.jobs
                    },
                    canRequestRevision: order.status === 'QUALITY_CHECK' && order.version_id,
                    canSubmitForReview: order.status === 'QUALITY_CHECK' && order.version_id
                }
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/webhook
     * Handle Stripe webhook events
     */
    async handleWebhook(req, res, next) {
        try {
            const signature = req.headers['stripe-signature'];
            const payload = req.body;

            if (!signature) {
                throw new ValidationError('Missing Stripe signature header');
            }

            // Verify webhook signature and get event
            const event = this.stripeService.verifyWebhookSignature(payload, signature);
            
            // Handle the webhook event
            const result = await this.stripeService.handleWebhookEvent(event);
            
            console.log(`Webhook handled: ${event.type}`, result);

            res.status(200).json({
                success: true,
                message: 'Webhook processed successfully',
                data: {
                    eventType: event.type,
                    handled: result.handled
                }
            });

        } catch (error) {
            console.error('Webhook handling error:', error);
            next(error);
        }
    }

    /**
     * GET /api/v1/purchase/payment-status/:orderId
     * Get payment status for an order
     */
    async getPaymentStatus(req, res, next) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }

            const paymentStatus = await this.stripeService.getPaymentStatus(orderId);

            res.status(200).json({
                success: true,
                message: 'Payment status retrieved successfully',
                data: paymentStatus
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/purchase/order/:orderId
     * Get order details for customer backlink configuration
     */
    async getOrderDetails(req, res, next) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }

            // Get order details from the service
            const orderDetails = await this.purchaseService.getOrderDetails(orderId);

            res.status(200).json({
                success: true,
                message: 'Order details retrieved successfully',
                order: orderDetails
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/configure-backlink
     * Configure backlink for a customer order
     */
    async configureBacklink(req, res, next) {
        try {
            const { orderId, backlinkUrl, anchorText, model, provider } = req.body;

            // Validate required fields
            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }

            // Get order to check if it's article generation or backlink integration
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { session: true }
            });

            if (!order) {
                throw new ValidationError('Order not found');
            }

            // Check if this is an article generation order
            const isArticleGeneration = order.session?.backlink_data?.type === 'ARTICLE_GENERATION';

            let result;
            if (isArticleGeneration) {
                // For article generation, we need different parameters
                const { title, topic, niche, keyword, targetURL, anchorText: articleAnchorText } = req.body;
                
                if (!title) {
                    throw new ValidationError('Article title is required');
                }
                if (!topic) {
                    throw new ValidationError('Article topic is required');
                }

                // Process article generation configuration
                result = await this.purchaseService.configureCustomerArticle(
                    orderId,
                    {
                        title,
                        topic,
                        niche: niche || '',
                        keyword: keyword || '',
                        targetURL: targetURL || '',
                        anchorText: articleAnchorText || ''
                    },
                    { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
                );
            } else {
                // Original backlink integration logic
                if (!backlinkUrl) {
                    throw new ValidationError('Backlink URL is required');
                }
                if (!anchorText) {
                    throw new ValidationError('Anchor text is required');
                }

                // Validate URL format
                try {
                    new URL(backlinkUrl);
                } catch {
                    throw new ValidationError('Invalid backlink URL format');
                }

                // Process backlink configuration
                result = await this.purchaseService.configureCustomerBacklink(
                    orderId,
                    backlinkUrl,
                    anchorText,
                    { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
                );
            }

            res.status(200).json({
                success: true,
                message: 'Backlink configured successfully',
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                previewContent: result.previewContent
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/regenerate-backlink
     * Regenerate backlink content for a customer order
     */
    async regenerateBacklink(req, res, next) {
        try {
            const { orderId, versionId, backlinkUrl, anchorText, model, provider } = req.body;

            // Validate required fields
            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }
            if (!versionId) {
                throw new ValidationError('Version ID is required');
            }

            // Get order to check if it's article generation or backlink integration
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { session: true }
            });

            if (!order) {
                throw new ValidationError('Order not found');
            }

            // Check if this is an article generation order
            const isArticleGeneration = order.session?.backlink_data?.type === 'ARTICLE_GENERATION';

            let result;
            if (isArticleGeneration) {
                // For article generation, we need different parameters
                const { title, topic, niche, keyword, targetURL, anchorText: articleAnchorText } = req.body;
                
                if (!title) {
                    throw new ValidationError('Article title is required');
                }
                if (!topic) {
                    throw new ValidationError('Article topic is required');
                }

                // Regenerate article content
                result = await this.purchaseService.regenerateCustomerArticle(
                    orderId,
                    versionId,
                    {
                        title,
                        topic,
                        niche: niche || '',
                        keyword: keyword || '',
                        targetURL: targetURL || '',
                        anchorText: articleAnchorText || ''
                    },
                    { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
                );
            } else {
                // Original backlink regeneration logic
                if (!backlinkUrl) {
                    throw new ValidationError('Backlink URL is required');
                }
                if (!anchorText) {
                    throw new ValidationError('Anchor text is required');
                }

                // Validate URL format
                try {
                    new URL(backlinkUrl);
                } catch {
                    throw new ValidationError('Invalid backlink URL format');
                }

                // Regenerate backlink content
                result = await this.purchaseService.regenerateCustomerBacklink(
                    orderId,
                    versionId,
                    backlinkUrl,
                    anchorText,
                    { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
                );
            }

            res.status(200).json({
                success: true,
                message: 'Backlink content regenerated successfully',
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                previewContent: result.previewContent
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/configure-article
     * Configure article generation for a customer order
     */
    async configureArticle(req, res, next) {
        try {
            const { orderId, title, niche, keyword, topic, targetURL, anchorText, model, provider } = req.body;

            // Validate required fields
            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }
            if (!title) {
                throw new ValidationError('Article title is required');
            }
            if (!topic) {
                throw new ValidationError('Article topic is required');
            }

            // Validate URL format if provided
            if (targetURL) {
                try {
                    new URL(targetURL);
                } catch {
                    throw new ValidationError('Invalid target URL format');
                }
            }

            // Process article generation
            const result = await this.purchaseService.configureCustomerArticle(
                orderId,
                {
                    title,
                    niche: niche || '',
                    keyword: keyword || '',
                    topic,
                    targetURL: targetURL || '',
                    anchorText: anchorText || ''
                },
                { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
            );

            res.status(200).json({
                success: true,
                message: 'Article generated successfully',
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                previewContent: result.previewContent
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/regenerate-article
     * Regenerate article content for a customer order
     */
    async regenerateArticle(req, res, next) {
        try {
            const { orderId, versionId, title, niche, keyword, topic, targetURL, anchorText, model, provider } = req.body;

            // Validate required fields
            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }
            if (!versionId) {
                throw new ValidationError('Version ID is required');
            }
            if (!title) {
                throw new ValidationError('Article title is required');
            }
            if (!topic) {
                throw new ValidationError('Article topic is required');
            }

            // Regenerate article content
            const result = await this.purchaseService.regenerateCustomerArticle(
                orderId,
                versionId,
                {
                    title,
                    niche: niche || '',
                    keyword: keyword || '',
                    topic,
                    targetURL: targetURL || '',
                    anchorText: anchorText || ''
                },
                { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
            );

            res.status(200).json({
                success: true,
                message: 'Article regenerated successfully',
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                previewContent: result.previewContent
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/regenerate-backlink
     * Regenerate backlink integration using the PUBLISHED article as base
     * Customer cannot modify the article - only regenerate the AI integration
     */
    async regenerateBacklink(req, res, next) {
        try {
            const { orderId } = req.body;

            // Validate required fields
            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }

            // Get order to check status and get details
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { 
                    article: true,
                    version: true 
                }
            });

            if (!order) {
                throw new NotFoundError('Order not found');
            }

            if (order.status !== 'QUALITY_CHECK') {
                throw new ValidationError('Can only regenerate when order is in QUALITY_CHECK status');
            }

            // Extract backlink data from order
            const backlinkData = order.backlink_data;
            
            // Add regeneration job to queue
            // This will ALWAYS use the PUBLISHED article as the base, not the customer's previous version
            const job = await this.queueService.addBacklinkIntegrationJob({
                orderId: order.id,
                articleId: order.article_id,
                targetUrl: backlinkData.target_url,
                anchorText: backlinkData.keyword,
                notes: backlinkData.notes,
                email: order.customer_email,
                isRegeneration: true // Flag to indicate this is a regeneration
            });

            // Update order status back to PROCESSING
            await prisma.order.update({
                where: { id: orderId },
                data: { 
                    status: 'PROCESSING',
                    updated_at: new Date()
                }
            });

            res.status(200).json({
                success: true,
                message: 'Regeneration request submitted successfully. The backlink will be re-integrated into the published article. You will receive an email when ready.',
                data: {
                    orderId: order.id,
                    jobId: job.id,
                    estimatedTime: '10-30 minutes',
                    note: 'The AI will re-integrate your backlink into the current published version of the article.'
                }
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/request-revision
     * DEPRECATED: Use regenerateBacklink instead
     * Kept for backwards compatibility
     */
    async requestRevision(req, res, next) {
        try {
            const { orderId } = req.body;

            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }

            // Redirect to regenerateBacklink
            return this.regenerateBacklink(req, res, next);

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/submit-for-review
     * Submit customer backlink for admin review
     */
    async submitForReview(req, res, next) {
        try {
            const { orderId, versionId } = req.body;

            // Validate required fields
            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }
            if (!versionId) {
                throw new ValidationError('Version ID is required');
            }

            // Submit for review
            const result = await this.purchaseService.submitCustomerBacklinkForReview(
                orderId,
                versionId
            );

            res.status(200).json({
                success: true,
                message: 'Article submitted for admin review successfully',
                reviewId: result.reviewId
            });

        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/v1/purchase/initiate-article
     * Initiate a new article purchase order and send magic link
     */
    async initiateArticlePurchase(req, res, next) {
        try {
            const { domainId, articleTitle, topic, niche, keyword, email, notes, type } = req.body;

            // Validate required fields
            if (!domainId) {
                throw new ValidationError('Domain ID is required');
            }
            if (!articleTitle) {
                throw new ValidationError('Article title is required');
            }
            if (!topic) {
                throw new ValidationError('Topic is required');
            }
            if (!email) {
                throw new ValidationError('Email is required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new ValidationError('Invalid email format');
            }

            // Create article purchase order
            const result = await this.purchaseService.initializeArticlePurchase({
                domainId,
                articleTitle,
                topic,
                niche: niche || '',
                keyword: keyword || '',
                email,
                notes: notes || '',
                price: 25.00 // Fixed price for article generation
            });

            res.status(200).json({
                success: true,
                message: 'Article purchase initiated successfully. Check your email for the magic link.',
                orderId: result.orderId,
                paymentUrl: result.paymentUrl,
                sessionToken: result.sessionToken
            });

        } catch (error) {
            next(error);
        }
    }
}

// Export controller methods directly
module.exports = {
    async initiatePurchase(req, res, next) {
        const controller = new PurchaseController();
        return controller.initiatePurchase(req, res, next);
    },
    
    async verifySession(req, res, next) {
        const controller = new PurchaseController();
        return controller.verifySession(req, res, next);
    },
    
    async completePayment(req, res, next) {
        const controller = new PurchaseController();
        return controller.completePayment(req, res, next);
    },
    
    async getOrderStatus(req, res, next) {
        const controller = new PurchaseController();
        return controller.getOrderStatus(req, res, next);
    },

    async handleWebhook(req, res, next) {
        const controller = new PurchaseController();
        return controller.handleWebhook(req, res, next);
    },

    async getPaymentStatus(req, res, next) {
        const controller = new PurchaseController();
        return controller.getPaymentStatus(req, res, next);
    },

    async getOrderDetails(req, res, next) {
        const controller = new PurchaseController();
        return controller.getOrderDetails(req, res, next);
    },

    async configureBacklink(req, res, next) {
        const controller = new PurchaseController();
        return controller.configureBacklink(req, res, next);
    },

    async regenerateBacklink(req, res, next) {
        const controller = new PurchaseController();
        return controller.regenerateBacklink(req, res, next);
    },

    async configureArticle(req, res, next) {
        const controller = new PurchaseController();
        return controller.configureArticle(req, res, next);
    },

    async regenerateArticle(req, res, next) {
        const controller = new PurchaseController();
        return controller.regenerateArticle(req, res, next);
    },

    async requestRevision(req, res, next) {
        const controller = new PurchaseController();
        return controller.requestRevision(req, res, next);
    },

    async submitForReview(req, res, next) {
        const controller = new PurchaseController();
        return controller.submitForReview(req, res, next);
    },

    async initiateArticlePurchase(req, res, next) {
        const controller = new PurchaseController();
        return controller.initiateArticlePurchase(req, res, next);
    }
};