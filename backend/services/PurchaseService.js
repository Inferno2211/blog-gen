const prisma = require('../db/prisma');
const BacklinkService = require('./BacklinkService');
const crypto = require('crypto');

/**
 * PurchaseService - Handles the complete purchase workflow for article backlink placements
 * Manages order initiation, session management, payment completion, and post-payment processing
 */
class PurchaseService {
    constructor() {
        this.backlinkService = new BacklinkService();
    }

    /**
     * Initiate a new purchase order
     * @param {string} articleId - The article ID to purchase backlink for
     * @param {Object} backlinkData - { keyword, target_url, notes? }
     * @param {string} email - Customer email
     * @returns {Promise<{sessionId: string, orderId: string}>}
     */
    async initiatePurchase(articleId, backlinkData, email) {
        // Validate inputs
        this._validatePurchaseInputs(articleId, backlinkData, email);

        // Check article availability
        await this._validateArticleAvailability(articleId);

        // Validate target URL
        this._validateTargetUrl(backlinkData.target_url);

        try {
            // Create purchase session with magic link token
            const magicLinkToken = this._generateMagicLinkToken();
            const magicLinkExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            const session = await prisma.purchaseSession.create({
                data: {
                    email: email.toLowerCase().trim(),
                    article_id: articleId,
                    backlink_data: backlinkData,
                    status: 'PENDING_AUTH',
                    magic_link_token: magicLinkToken,
                    magic_link_expires: magicLinkExpires
                }
            });

            // Update article availability status
            await this._updateArticleAvailability(articleId, 'PROCESSING');

            // Log the initiation event
            console.log(`Purchase initiated - Session: ${session.id}, Article: ${articleId}, Email: ${email}`);

            return {
                sessionId: session.id,
                magicLinkToken: magicLinkToken
            };
        } catch (error) {
            console.error('Failed to initiate purchase:', error);
            throw new Error(`Failed to initiate purchase: ${error.message}`);
        }
    }

    /**
     * Verify and authenticate a session using magic link token
     * @param {string} sessionToken - The magic link token
     * @returns {Promise<{valid: boolean, sessionData?: Object}>}
     */
    async verifySession(sessionToken) {
        if (!sessionToken) {
            return { valid: false, error: 'Session token is required' };
        }

        try {
            const session = await prisma.purchaseSession.findUnique({
                where: { magic_link_token: sessionToken },
                include: { article: true }
            });

            if (!session) {
                return { valid: false, error: 'Invalid session token' };
            }

            // Check if token has expired
            if (new Date() > session.magic_link_expires) {
                return { valid: false, error: 'Session token has expired' };
            }

            // Check if session is in correct state
            if (session.status !== 'PENDING_AUTH') {
                return { valid: false, error: 'Session is not in valid state for authentication' };
            }

            // Update session status to authenticated
            await prisma.purchaseSession.update({
                where: { id: session.id },
                data: { status: 'AUTHENTICATED' }
            });

            console.log(`Session verified - Session: ${session.id}, Email: ${session.email}`);

            return {
                valid: true,
                sessionData: {
                    sessionId: session.id,
                    email: session.email,
                    articleId: session.article_id,
                    backlinkData: session.backlink_data,
                    articleTitle: session.article.slug
                }
            };
        } catch (error) {
            console.error('Failed to verify session:', error);
            return { valid: false, error: 'Failed to verify session' };
        }
    }

    /**
     * Complete payment and initiate backlink processing
     * @param {string} sessionId - The purchase session ID
     * @param {string} stripeSessionId - The Stripe checkout session ID
     * @returns {Promise<{orderId: string, status: string}>}
     */
    async completePayment(sessionId, stripeSessionId) {
        if (!sessionId || !stripeSessionId) {
            throw new Error('Session ID and Stripe session ID are required');
        }

        try {
            // Get the purchase session
            const session = await prisma.purchaseSession.findUnique({
                where: { id: sessionId },
                include: { article: true }
            });

            if (!session) {
                throw new Error('Purchase session not found');
            }

            if (session.status !== 'AUTHENTICATED') {
                throw new Error('Session is not in valid state for payment completion');
            }

            // Create order record
            const order = await prisma.order.create({
                data: {
                    session_id: sessionId,
                    article_id: session.article_id,
                    customer_email: session.email,
                    backlink_data: session.backlink_data,
                    payment_data: {
                        stripe_session_id: stripeSessionId,
                        amount: 1500, // $15.00 in cents
                        currency: 'usd',
                        status: 'completed'
                    },
                    status: 'PROCESSING'
                }
            });

            // Update session status
            await prisma.purchaseSession.update({
                where: { id: sessionId },
                data: { 
                    status: 'PAID',
                    stripe_session_id: stripeSessionId
                }
            });

            console.log(`Payment completed - Order: ${order.id}, Session: ${sessionId}`);

            // Initiate backlink processing asynchronously
            this._processBacklinkIntegration(order.id).catch(error => {
                console.error(`Backlink processing failed for order ${order.id}:`, error);
            });

            return {
                orderId: order.id,
                status: 'PROCESSING'
            };
        } catch (error) {
            console.error('Failed to complete payment:', error);
            throw new Error(`Failed to complete payment: ${error.message}`);
        }
    }

    /**
     * Process backlink integration for a completed order
     * @param {string} orderId - The order ID
     * @returns {Promise<void>}
     */
    async processBacklinkIntegration(orderId) {
        return this._processBacklinkIntegration(orderId);
    }

    /**
     * Get order status and progress
     * @param {string} orderId - The order ID
     * @returns {Promise<{status: string, progress: Object, estimatedCompletion?: Date}>}
     */
    async getOrderStatus(orderId) {
        if (!orderId) {
            throw new Error('Order ID is required');
        }

        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    session: true,
                    article: true,
                    version: true
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            const progress = this._calculateOrderProgress(order);
            const estimatedCompletion = this._estimateCompletion(order);

            return {
                status: order.status,
                progress: progress,
                estimatedCompletion: estimatedCompletion,
                orderDetails: {
                    orderId: order.id,
                    articleTitle: order.article.slug,
                    backlinkData: order.backlink_data,
                    createdAt: order.created_at,
                    completedAt: order.completed_at
                }
            };
        } catch (error) {
            console.error('Failed to get order status:', error);
            throw new Error(`Failed to get order status: ${error.message}`);
        }
    }

    /**
     * Handle quality check results for an order
     * @param {string} orderId - The order ID
     * @param {Object} qcResult - Quality check result
     * @returns {Promise<void>}
     */
    async handleQualityCheckResult(orderId, qcResult) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            if (qcResult.passed) {
                // Quality checks passed, move to admin review
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'ADMIN_REVIEW' }
                });
                console.log(`Order ${orderId} moved to admin review after passing quality checks`);
            } else {
                // Quality checks failed, keep in quality check status
                console.log(`Order ${orderId} failed quality checks, will retry`);
            }
        } catch (error) {
            console.error(`Failed to handle quality check result for order ${orderId}:`, error);
            throw error;
        }
    }

    // Private helper methods

    /**
     * Validate purchase inputs
     * @private
     */
    _validatePurchaseInputs(articleId, backlinkData, email) {
        if (!articleId) {
            throw new Error('Article ID is required');
        }

        if (!backlinkData || typeof backlinkData !== 'object') {
            throw new Error('Backlink data is required');
        }

        if (!backlinkData.keyword || !backlinkData.target_url) {
            throw new Error('Keyword and target URL are required in backlink data');
        }

        if (!email) {
            throw new Error('Email is required');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }
    }

    /**
     * Validate article availability
     * @private
     */
    async _validateArticleAvailability(articleId) {
        const article = await prisma.article.findUnique({
            where: { id: articleId }
        });

        if (!article) {
            throw new Error('Article not found');
        }

        if (article.availability_status !== 'AVAILABLE') {
            throw new Error('Article is not available for purchase');
        }
    }

    /**
     * Validate target URL format
     * @private
     */
    _validateTargetUrl(url) {
        try {
            new URL(url);
        } catch {
            throw new Error('Invalid target URL format');
        }
    }

    /**
     * Generate secure magic link token
     * @private
     */
    _generateMagicLinkToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Update article availability status
     * @private
     */
    async _updateArticleAvailability(articleId, status) {
        await prisma.article.update({
            where: { id: articleId },
            data: { availability_status: status }
        });
    }

    /**
     * Process backlink integration (internal method)
     * @private
     */
    async _processBacklinkIntegration(orderId) {
        try {
            console.log(`Starting backlink integration for order ${orderId}`);

            // Get order details
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { article: true }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            // Update order status to quality check
            await prisma.order.update({
                where: { id: orderId },
                data: { status: 'QUALITY_CHECK' }
            });

            // Integrate backlink using BacklinkService
            const backlinkData = order.backlink_data;
            const result = await this.backlinkService.integrateBacklink(
                order.article_id,
                backlinkData.target_url,
                backlinkData.keyword
            );

            // Update order with version ID
            await prisma.order.update({
                where: { id: orderId },
                data: { 
                    version_id: result.versionId,
                    status: 'ADMIN_REVIEW'
                }
            });

            console.log(`Backlink integration completed for order ${orderId}, version ${result.versionId}`);

        } catch (error) {
            console.error(`Backlink integration failed for order ${orderId}:`, error);
            
            // Update order status to failed
            await prisma.order.update({
                where: { id: orderId },
                data: { status: 'FAILED' }
            }).catch(updateError => {
                console.error(`Failed to update order status to FAILED:`, updateError);
            });

            // Reset article availability
            const order = await prisma.order.findUnique({
                where: { id: orderId }
            });
            if (order) {
                await this._updateArticleAvailability(order.article_id, 'AVAILABLE');
            }

            throw error;
        }
    }

    /**
     * Calculate order progress
     * @private
     */
    _calculateOrderProgress(order) {
        const progressSteps = {
            'PROCESSING': { step: 1, total: 4, description: 'Processing payment and initiating backlink integration' },
            'QUALITY_CHECK': { step: 2, total: 4, description: 'Running quality checks on integrated content' },
            'ADMIN_REVIEW': { step: 3, total: 4, description: 'Pending admin review and approval' },
            'COMPLETED': { step: 4, total: 4, description: 'Article published with backlink' },
            'FAILED': { step: 0, total: 4, description: 'Order processing failed' },
            'REFUNDED': { step: 0, total: 4, description: 'Order refunded' }
        };

        return progressSteps[order.status] || { step: 0, total: 4, description: 'Unknown status' };
    }

    /**
     * Estimate completion time
     * @private
     */
    _estimateCompletion(order) {
        const now = new Date();
        const createdAt = new Date(order.created_at);
        const elapsedHours = (now - createdAt) / (1000 * 60 * 60);

        // Estimate based on current status
        switch (order.status) {
            case 'PROCESSING':
                return new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
            case 'QUALITY_CHECK':
                return new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
            case 'ADMIN_REVIEW':
                return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
            case 'COMPLETED':
                return order.completed_at;
            default:
                return null;
        }
    }
}

module.exports = PurchaseService;