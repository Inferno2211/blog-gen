const prisma = require('../db/prisma');
const BacklinkService = require('./BacklinkService');
const EmailService = require('./EmailService');
const crypto = require('crypto');

/**
 * PurchaseService - Handles the complete purchase workflow for article backlink placements
 * Manages order initiation, session management, payment completion, and post-payment processing
 */
class PurchaseService {
    constructor() {
        this.backlinkService = new BacklinkService();
        this.emailService = new EmailService();
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

            // Check if session is in correct state for verification
            // Allow PENDING_AUTH, AUTHENTICATED, and PAYMENT_PENDING states
            const validStatesForVerification = ['PENDING_AUTH', 'AUTHENTICATED', 'PAYMENT_PENDING'];
            if (!validStatesForVerification.includes(session.status)) {
                return { valid: false, error: `Session is not in valid state for authentication. Current status: ${session.status}` };
            }

            // Update session status to authenticated (only if not already authenticated or beyond)
            if (session.status === 'PENDING_AUTH') {
                await prisma.purchaseSession.update({
                    where: { id: session.id },
                    data: { status: 'AUTHENTICATED' }
                });
            }

            console.log(`Session verified - Session: ${session.id}, Email: ${session.email}`);

            return {
                valid: true,
                sessionData: {
                    sessionId: session.id,
                    email: session.email,
                    article_id: session.article_id,
                    backlink_data: session.backlink_data,
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
     * This method handles both webhook-processed payments and manual completion
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
                include: { 
                    article: true,
                    orders: {
                        orderBy: { created_at: 'desc' },
                        take: 1
                    }
                }
            });

            if (!session) {
                throw new Error('Purchase session not found');
            }

            // Case 1: Webhook already processed the payment (session is PAID)
            if (session.status === 'PAID') {
                // Find the order created by the webhook
                const existingOrder = session.orders[0] || await prisma.order.findFirst({
                    where: { 
                        session_id: sessionId,
                        status: { in: ['PROCESSING', 'ADMIN_REVIEW', 'COMPLETED'] }
                    },
                    orderBy: { created_at: 'desc' }
                });

                if (existingOrder) {
                    console.log(`Payment already completed by webhook - Order: ${existingOrder.id}, Session: ${sessionId}`);
                    return {
                        orderId: existingOrder.id,
                        status: existingOrder.status
                    };
                } else {
                    throw new Error('Session marked as PAID but no order found');
                }
            }

            // Case 2: Session is authenticated, we need to complete the payment manually (fallback)
            if (session.status === 'AUTHENTICATED') {
                console.log(`Processing payment manually for session ${sessionId} (webhook may have failed)`);
                
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

                console.log(`Payment completed manually - Order: ${order.id}, Session: ${sessionId}`);

                return {
                    orderId: order.id,
                    status: 'PROCESSING'
                };
            }

            // Case 3: Invalid session state
            throw new Error(`Session is not in valid state for payment completion. Current status: ${session.status}`);

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
                    article: true
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
                    articleTitle: order.article ? order.article.slug : 'Unknown Article',
                    backlinkData: order.backlink_data,
                    customerEmail: order.customer_email,
                    createdAt: order.created_at,
                    completedAt: order.completed_at
                }
            };
        } catch (error) {
            console.error('Failed to get order status:', error);
            
            // Re-throw the original error if it's "Order not found"
            if (error.message === 'Order not found') {
                throw error;
            }
            
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

    /**
     * Process refund for a rejected order
     * @param {string} orderId - The order ID
     * @param {string} reason - Refund reason
     * @returns {Promise<Object>} Refund result
     */
    async processRefund(orderId, reason = 'Backlink rejected during review') {
        try {
            const StripeService = require('./StripeService');
            const stripeService = new StripeService();
            
            const refundResult = await stripeService.processRefund(orderId, reason);
            
            console.log(`Refund processed for order ${orderId}:`, refundResult);
            
            return refundResult;
        } catch (error) {
            console.error(`Failed to process refund for order ${orderId}:`, error);
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

            // Update order status to admin review (skip quality check)
            await prisma.order.update({
                where: { id: orderId },
                data: { status: 'ADMIN_REVIEW' }
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
     * Get detailed order information for customer backlink configuration
     * @param {string} orderId - The order ID
     * @returns {Promise<Object>} Order details with article information
     */
    async getOrderDetails(orderId) {
        if (!orderId) {
            throw new Error('Order ID is required');
        }

        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    session: true,
                    version: true, // Include the order's specific version
                    article: {
                        include: {
                            domain: true,
                            selected_version: true,
                            versions: {
                                orderBy: { version_num: 'desc' },
                                take: 1
                            }
                        }
                    }
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            if (order.status !== 'PAID' && order.status !== 'PROCESSING' && order.status !== 'ADMIN_REVIEW') {
                throw new Error('Order is not in valid state for backlink configuration');
            }

            return {
                id: order.id,
                sessionId: order.session_id,
                articleId: order.article_id,
                customerEmail: order.customer_email,
                backlinkData: order.backlink_data,
                status: order.status,
                generatedVersion: order.version ? {
                    id: order.version.id,
                    version_num: order.version.version_num,
                    content_md: order.version.content_md,
                    backlink_review_status: order.version.backlink_review_status
                } : null,
                article: {
                    id: order.article.id,
                    slug: order.article.slug,
                    topic: order.article.topic,
                    niche: order.article.niche,
                    keyword: order.article.keyword,
                    domain: {
                        slug: order.article.domain.slug,
                        name: order.article.domain.name
                    },
                    selected_version: order.article.selected_version || order.article.versions[0]
                }
            };
        } catch (error) {
            console.error('Failed to get order details:', error);
            throw new Error(`Failed to get order details: ${error.message}`);
        }
    }

    /**
     * Configure customer backlink integration
     * @param {string} orderId - The order ID
     * @param {string} backlinkUrl - The backlink URL
     * @param {string} anchorText - The anchor text
     * @param {Object} options - AI options { model?, provider? }
     * @returns {Promise<Object>} Integration result
     */
    async configureCustomerBacklink(orderId, backlinkUrl, anchorText, options = {}) {
        if (!orderId || !backlinkUrl || !anchorText) {
            throw new Error('Order ID, backlink URL, and anchor text are required');
        }

        try {
            // Get order details
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { article: true }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            if (order.status !== 'PAID' && order.status !== 'PROCESSING') {
                throw new Error('Order is not in valid state for backlink configuration');
            }

            // Integrate backlink using the BacklinkService with QC
            const result = await this.backlinkService.integrateBacklink(
                order.article_id,
                backlinkUrl,
                anchorText,
                { 
                    ...options,
                    runQualityCheck: true, // Enable QC with regeneration
                    maxQcRetries: 3 
                }
            );

            // Update order status and link to the new version - skip QUALITY_CHECK, go to PROCESSING
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    version_id: result.versionId,
                    status: 'PROCESSING' // Stay in PROCESSING until submitted for review
                }
            });

            console.log(`Customer backlink configured for order ${orderId}, created version ${result.versionId}`);

            return {
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                previewContent: result.previewContent
            };

        } catch (error) {
            console.error(`Customer backlink configuration failed for order ${orderId}:`, error);
            throw new Error(`Failed to configure backlink: ${error.message}`);
        }
    }

    /**
     * Regenerate customer backlink content
     * @param {string} orderId - The order ID
     * @param {string} versionId - The version ID to regenerate
     * @param {string} backlinkUrl - The backlink URL
     * @param {string} anchorText - The anchor text
     * @param {Object} options - AI options { model?, provider? }
     * @returns {Promise<Object>} Regeneration result
     */
    async regenerateCustomerBacklink(orderId, versionId, backlinkUrl, anchorText, options = {}) {
        if (!orderId || !versionId || !backlinkUrl || !anchorText) {
            throw new Error('Order ID, version ID, backlink URL, and anchor text are required');
        }

        try {
            // Get order and validate
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { article: true }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            if (order.version_id !== versionId) {
                throw new Error('Version ID does not match order');
            }

            // Get the version to regenerate from
            const existingVersion = await prisma.articleVersion.findUnique({
                where: { id: versionId }
            });

            if (!existingVersion) {
                throw new Error('Version not found');
            }

            // Re-integrate backlink with new content and QC
            const result = await this.backlinkService.integrateBacklink(
                order.article_id,
                backlinkUrl,
                anchorText,
                { 
                    ...options,
                    runQualityCheck: true, // Enable QC with regeneration
                    maxQcRetries: 3 
                }
            );

            // Update order to point to new version
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    version_id: result.versionId
                }
            });

            console.log(`Customer backlink regenerated for order ${orderId}, created version ${result.versionId}`);

            return {
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                previewContent: result.previewContent
            };

        } catch (error) {
            console.error(`Customer backlink regeneration failed for order ${orderId}:`, error);
            throw new Error(`Failed to regenerate backlink: ${error.message}`);
        }
    }

    /**
     * Submit customer backlink for admin review
     * @param {string} orderId - The order ID
     * @param {string} versionId - The version ID to submit
     * @returns {Promise<Object>} Submission result
     */
    async submitCustomerBacklinkForReview(orderId, versionId) {
        if (!orderId || !versionId) {
            throw new Error('Order ID and version ID are required');
        }

        try {
            // Get order and validate
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { 
                    article: true,
                    version: true
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            if (order.version_id !== versionId) {
                throw new Error('Version ID does not match order');
            }

            // Update order status to admin review
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    status: 'ADMIN_REVIEW'
                }
            });

            // Update the article version to indicate it's ready for review
            await prisma.articleVersion.update({
                where: { id: versionId },
                data: {
                    backlink_review_status: 'PENDING_REVIEW',
                    last_qc_status: 'CUSTOMER_SUBMITTED',
                    last_qc_notes: {
                        message: 'Customer submitted backlink integration for admin review',
                        type: 'customer_submission',
                        timestamp: new Date().toISOString()
                    }
                }
            });

            // Send notification email to customer
            try {
                await this.emailService.sendOrderConfirmation(
                    order.customer_email,
                    {
                        id: order.id,
                        status: 'ADMIN_REVIEW',
                        articleTitle: order.article.topic || order.article.slug,
                        backlinkData: order.backlink_data
                    }
                );
            } catch (emailError) {
                console.warn('Failed to send review submission confirmation email:', emailError.message);
            }

            console.log(`Customer backlink submitted for review: order ${orderId}, version ${versionId}`);

            return {
                reviewId: versionId,
                status: 'ADMIN_REVIEW',
                message: 'Article submitted for admin review successfully'
            };

        } catch (error) {
            console.error(`Customer backlink submission failed for order ${orderId}:`, error);
            throw new Error(`Failed to submit for review: ${error.message}`);
        }
    }

    // Private helper methods

    /**
     * Calculate order progress
     * @private
     */
    _calculateOrderProgress(order) {
        const progressSteps = {
            'PROCESSING': { step: 1, total: 3, description: 'Processing payment and backlink integration' },
            'ADMIN_REVIEW': { step: 2, total: 3, description: 'Pending admin review and approval' },
            'COMPLETED': { step: 3, total: 3, description: 'Article published with backlink' },
            'FAILED': { step: 0, total: 3, description: 'Order processing failed' },
            'REFUNDED': { step: 0, total: 3, description: 'Order refunded' }
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
                return new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour (includes QC)
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