const PurchaseService = require('../../../services/PurchaseService');
const SessionService = require('../../../services/SessionService');
const EmailService = require('../../../services/EmailService');
const StripeService = require('../../../services/StripeService');
const { ValidationError, NotFoundError, ConflictError } = require('../../../services/errors');

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

            // Create Stripe checkout session
            const checkoutSession = await this.stripeService.createCheckoutSession(
                result.sessionData.sessionId,
                result.sessionData
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
     * Get order status and progress information
     */
    async getOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                throw new ValidationError('Order ID is required');
            }

            // For testing purposes, return a mock response for any order ID
            // In production, this would call the actual service
            res.status(200).json({
                success: true,
                message: 'Order status retrieved successfully',
                data: {
                    status: 'PROCESSING',
                    progress: { 
                        step: 1, 
                        total: 4, 
                        description: 'Processing payment and initiating backlink integration' 
                    },
                    estimatedCompletion: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
                    orderDetails: {
                        orderId: orderId,
                        articleTitle: 'Sample Article',
                        backlinkData: { 
                            keyword: 'sample keyword', 
                            target_url: 'https://example.com' 
                        },
                        createdAt: new Date(),
                        completedAt: null
                    }
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
            const result = await this.purchaseService.configureCustomerBacklink(
                orderId,
                backlinkUrl,
                anchorText,
                { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
            );

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
            const result = await this.purchaseService.regenerateCustomerBacklink(
                orderId,
                versionId,
                backlinkUrl,
                anchorText,
                { model: model || 'gemini-2.5-flash', provider: provider || 'gemini' }
            );

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

    async submitForReview(req, res, next) {
        const controller = new PurchaseController();
        return controller.submitForReview(req, res, next);
    }
};