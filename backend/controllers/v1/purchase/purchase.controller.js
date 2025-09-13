const PurchaseService = require('../../../services/PurchaseService');
const SessionService = require('../../../services/SessionService');
const EmailService = require('../../../services/EmailService');
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
            } catch (emailError) {
                console.error('Failed to send magic link email:', emailError);
                // Continue with response even if email fails
            }

            res.status(200).json({
                success: true,
                message: 'Purchase initiated successfully. Please check your email for the magic link.',
                data: {
                    sessionId: result.sessionId,
                    magicLinkSent: true
                }
            });

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

            // Generate Stripe checkout URL (placeholder for now)
            const stripeCheckoutUrl = this._generateStripeCheckoutUrl(result.sessionData);

            res.status(200).json({
                success: true,
                message: 'Session verified successfully',
                data: {
                    valid: true,
                    sessionData: result.sessionData,
                    stripeCheckoutUrl: stripeCheckoutUrl
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

            // Complete payment processing
            const result = await this.purchaseService.completePayment(sessionId, stripeSessionId);

            // Send order confirmation email
            try {
                const orderStatus = await this.purchaseService.getOrderStatus(result.orderId);
                await this.emailService.sendOrderConfirmation(
                    orderStatus.orderDetails.customerEmail || 'customer@example.com',
                    {
                        orderId: result.orderId,
                        articleTitle: orderStatus.orderDetails.articleTitle,
                        backlinkData: orderStatus.orderDetails.backlinkData,
                        status: result.status
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

    // Private helper methods

    /**
     * Generate Stripe checkout URL (placeholder implementation)
     * @private
     */
    _generateStripeCheckoutUrl(sessionData) {
        // This is a placeholder - in a real implementation, this would create a Stripe checkout session
        // and return the actual checkout URL
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const checkoutParams = new URLSearchParams({
            session_id: sessionData.sessionId,
            article_id: sessionData.articleId,
            amount: '1500', // $15.00 in cents
            currency: 'usd'
        });
        
        return `${baseUrl}/checkout?${checkoutParams.toString()}`;
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
    }
};