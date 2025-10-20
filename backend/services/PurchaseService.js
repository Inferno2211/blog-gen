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
     * Initialize article purchase order (separate from backlink purchases)
     * @param {Object} articleData - { domainId, articleTitle, topic, niche, keyword, email, notes, price }
     * @returns {Promise<{orderId: string, paymentUrl: string, sessionToken: string}>}
     */
    async initializeArticlePurchase(articleData) {
        const { domainId, articleTitle, topic, niche, keyword, targetUrl, anchorText, email, notes, price } = articleData;

        // Validate inputs
        if (!domainId || !articleTitle || !topic || !email) {
            throw new Error('Missing required fields for article purchase');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Verify domain exists
        const domain = await prisma.domain.findUnique({
            where: { id: domainId }
        });

        if (!domain) {
            throw new Error('Invalid domain ID');
        }

        try {
            // Create article record first (with DRAFT status, will be updated after generation)
            const article = await prisma.article.create({
                data: {
                    slug: this._generateSlug(articleTitle),
                    topic: articleTitle, // Use articleTitle as the topic
                    niche: niche || '',
                    keyword: keyword || '',
                    backlink_target: targetUrl || null, // Optional backlink
                    anchor: anchorText || null, // Optional anchor text
                    domain_id: domainId,
                    status: 'DRAFT',
                    availability_status: 'PROCESSING'
                }
            });

            // Create purchase session with magic link token
            const magicLinkToken = this._generateMagicLinkToken();
            const magicLinkExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            const session = await prisma.purchaseSession.create({
                data: {
                    email: email.toLowerCase().trim(),
                    article_id: article.id,
                    backlink_data: {
                        type: 'ARTICLE_GENERATION',
                        articleTitle,
                        topic,
                        niche,
                        keyword,
                        targetUrl: targetUrl || null, // Include optional backlink
                        anchorText: anchorText || null, // Include optional anchor text
                        notes: notes || ''
                    },
                    status: 'PENDING_AUTH',
                    magic_link_token: magicLinkToken,
                    magic_link_expires: magicLinkExpires
                }
            });

            // Send magic link email
            await this.emailService.sendMagicLink(
                email,
                magicLinkToken,
                {
                    sessionId: session.id,
                    articleId: article.id,
                    articleTitle: articleTitle,
                    domainName: domain.name,
                    type: 'article_generation'
                }
            );

            console.log(`Article purchase initiated for ${email}, session: ${session.id}, article: ${article.id}`);

            return {
                sessionId: session.id,
                magicLinkSent: true
            };

        } catch (error) {
            console.error('Failed to initialize article purchase:', error);
            throw new Error(`Failed to initiate article purchase: ${error.message}`);
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
                include: { 
                    article: true,
                    orders: {
                        orderBy: { created_at: 'desc' },
                        take: 1
                    }
                }
            });

            if (!session) {
                return { valid: false, error: 'Invalid session token' };
            }

            // Check if token has expired
            if (new Date() > session.magic_link_expires) {
                return { valid: false, error: 'Session token has expired' };
            }

            // Check if session is in correct state for verification
            // Allow PENDING_AUTH, AUTHENTICATED, PAYMENT_PENDING, and PAID states
            const validStatesForVerification = ['PENDING_AUTH', 'AUTHENTICATED', 'PAYMENT_PENDING', 'PAID'];
            if (!validStatesForVerification.includes(session.status)) {
                return { valid: false, error: `Session is not in valid state for authentication. Current status: ${session.status}` };
            }

            // Check if session already has payment completed
            const isAlreadyPaid = session.status === 'PAID';
            const existingOrder = session.orders[0]; // Most recent order

            // If session is paid but user is verifying again, redirect them to configuration
            if (isAlreadyPaid && existingOrder) {
                console.log(`Session ${session.id} already paid, redirecting to configuration`);
                
                // Determine order type for proper redirection
                const isArticleGeneration = session.backlink_data?.type === 'ARTICLE_GENERATION';
                
                return {
                    valid: true,
                    alreadyPaid: true,
                    orderId: existingOrder.id,
                    orderType: isArticleGeneration ? 'article_generation' : 'backlink',
                    sessionData: {
                        sessionId: session.id,
                        email: session.email,
                        article_id: session.article_id,
                        backlink_data: session.backlink_data,
                        articleTitle: session.article.slug
                    }
                };
            }

            // Update session status to authenticated (only if not already authenticated or beyond)
            if (session.status === 'PENDING_AUTH') {
                await prisma.purchaseSession.update({
                    where: { id: session.id },
                    data: { status: 'AUTHENTICATED' }
                });
            }

            // For authenticated sessions, we need to create or check Stripe checkout session
            if (session.status === 'AUTHENTICATED') {
                const StripeService = require('./StripeService');
                const stripeService = new StripeService();
                
                // Check if session already has a valid Stripe session
                if (session.stripe_session_id) {
                    console.log(`Session ${session.id} authenticated with existing Stripe session`);
                    
                    try {
                        const stripeSession = await stripeService.verifyCheckoutSession(session.stripe_session_id);
                        if (stripeSession.payment_status === 'unpaid') {
                            return {
                                valid: true,
                                sessionData: {
                                    sessionId: session.id,
                                    email: session.email,
                                    article_id: session.article_id,
                                    backlink_data: session.backlink_data,
                                    articleTitle: session.article.slug
                                },
                                stripeCheckoutUrl: `https://checkout.stripe.com/pay/${session.stripe_session_id}`
                            };
                        }
                    } catch (stripeError) {
                        console.log(`Stripe session ${session.stripe_session_id} invalid, will create new one`);
                    }
                }
                
                // Create new Stripe checkout session if needed
                console.log(`Creating Stripe checkout session for session ${session.id}`);
                
                try {
                    const checkoutSession = await stripeService.createCheckoutSession(session.id, {
                        article_id: session.article_id,
                        backlink_data: session.backlink_data,
                        email: session.email,
                        type: session.backlink_data?.type === 'ARTICLE_GENERATION' ? 'article_generation' : 'backlink'
                    });
                    
                    return {
                        valid: true,
                        sessionData: {
                            sessionId: session.id,
                            email: session.email,
                            article_id: session.article_id,
                            backlink_data: session.backlink_data,
                            articleTitle: session.article.slug
                        },
                        stripeCheckoutUrl: checkoutSession.url
                    };
                } catch (stripeError) {
                    console.error(`Failed to create Stripe checkout session:`, stripeError);
                    return { valid: false, error: 'Failed to create payment session' };
                }
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
                
                // Determine payment amount based on order type
                const isArticleGeneration = session.backlink_data?.type === 'ARTICLE_GENERATION';
                const amount = isArticleGeneration ? 2500 : 1500; // $25 for articles, $15 for backlinks
                
                // Create order record
                const order = await prisma.order.create({
                    data: {
                        session_id: sessionId,
                        article_id: session.article_id,
                        customer_email: session.email,
                        backlink_data: session.backlink_data,
                        payment_data: {
                            stripe_session_id: stripeSessionId,
                            amount: amount,
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
     * Generate URL-friendly slug from title
     * @param {string} title - Article title
     * @returns {string} URL-friendly slug
     */
    _generateSlug(title) {
        const baseSlug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        
        // Add timestamp to ensure uniqueness
        const timestamp = Date.now().toString(36); // Convert to base36 for shorter string
        const randomSuffix = Math.random().toString(36).substr(2, 5); // Add random suffix
        return `${baseSlug}-${timestamp}-${randomSuffix}`;
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
                        message: 'Customer submitted content for admin review',
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

    /**
     * Configure customer article generation
     * @param {string} orderId - The order ID
     * @param {Object} articleData - Article configuration data
     * @param {Object} options - AI options { model?, provider? }
     * @returns {Promise<Object>} Generation result
     */
    async configureCustomerArticle(orderId, articleData, options = {}) {
        try {
            console.log(`Starting article generation for order ${orderId}`);

            // Get order details with proper error handling
            console.log(`Looking for order with ID: ${orderId}`);
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { 
                    article: {
                        include: {
                            domain: true,
                            versions: true
                        }
                    }
                }
            });

            if (!order) {
                console.log(`Order not found for ID: ${orderId}`);
                
                // Check if this is the common "pending" issue
                if (orderId === "pending") {
                    throw new Error("Invalid order ID 'pending'. Please check your payment status or start a new order.");
                }
                
                // Try to find any orders to see what exists
                const allOrders = await prisma.order.findMany({
                    select: { id: true, status: true, customer_email: true, created_at: true },
                    orderBy: { created_at: 'desc' },
                    take: 5
                });
                console.log('Recent orders:', allOrders);
                throw new Error(`Order not found with ID: ${orderId}. Please verify your order ID or check your payment status.`);
            }

            console.log(`Found order ${orderId} with status ${order.status}, article ID: ${order.article.id}`);

            // Allow multiple statuses for configuration
            if (!['PROCESSING', 'QUALITY_CHECK'].includes(order.status)) {
                throw new Error(`Order must be in processing or quality_check status to configure article. Current status: ${order.status}`);
            }

            // Update order status to processing if not already (outside transaction)
            if (order.status !== 'PROCESSING') {
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'PROCESSING' }
                });
            }

            // Generate article using existing core service (this takes a long time, so outside transaction)
            console.log(`Starting AI generation for order ${orderId}...`);
            let generationResult;
            try {
                generationResult = await this._generateCustomerArticle(
                    order.article.id,
                    order.article.domain,
                    articleData,
                    options
                );
                console.log(`AI generation completed for order ${orderId}, got version ${generationResult.versionId}`);
            } catch (aiError) {
                // Reset order status to allow retry
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'PROCESSING' } // Keep it in processing for retry
                });
                throw new Error(`AI generation failed: ${aiError.message}`);
            }

            // Validate generation result
            if (!generationResult || !generationResult.versionId) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'PROCESSING' } // Keep it in processing for retry
                });
                throw new Error('AI generation did not produce a valid version');
            }

            // Use a quick transaction only for the final database updates
            const result = await prisma.$transaction(async (tx) => {
                // Verify order still exists and get current state
                const currentOrder = await tx.order.findUnique({
                    where: { id: orderId }
                });

                if (!currentOrder) {
                    throw new Error(`Order ${orderId} no longer exists`);
                }

                // Prepare update data for the order
                const updateData = {
                    version_id: generationResult.versionId,
                    status: 'QUALITY_CHECK' // Move to next stage
                };
                
                // If a new article was created (initial generation case), update the article_id
                if (generationResult.articleId && generationResult.articleId !== currentOrder.article_id) {
                    console.log(`Updating order ${orderId} to reference new article ${generationResult.articleId}`);
                    updateData.article_id = generationResult.articleId;
                }

                // Update the order within the transaction
                await tx.order.update({
                    where: { id: orderId },
                    data: updateData
                });

                return generationResult;
            }, {
                timeout: 10000 // 10 second timeout should be enough for simple DB updates
            });

            console.log(`Article generation completed for order ${orderId}, version: ${result.versionId}`);
            return result;

        } catch (error) {
            console.error(`Failed to configure article for order ${orderId}:`, error);
            throw new Error(`Article generation failed: ${error.message}`);
        }
    }

    /**
     * Regenerate customer article content
     * @param {string} orderId - The order ID
     * @param {string} versionId - The version ID to regenerate
     * @param {Object} articleData - Article configuration data
     * @param {Object} options - AI options { model?, provider? }
     * @returns {Promise<Object>} Regeneration result
     */
    async regenerateCustomerArticle(orderId, versionId, articleData, options = {}) {
        try {
            console.log(`Regenerating article for order ${orderId}, version ${versionId}`);

            // Get order and version details
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { 
                    article: {
                        include: {
                            domain: true,
                            versions: {
                                where: { id: versionId }
                            }
                        }
                    }
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            if (order.article.versions.length === 0) {
                throw new Error('Version not found');
            }

            if (order.version_id !== versionId) {
                throw new Error('Version ID does not match order');
            }

            // Generate new article content (outside transaction due to long processing time)
            console.log(`Starting AI regeneration for order ${orderId}...`);
            let generationResult;
            try {
                generationResult = await this._generateCustomerArticle(
                    order.article.id,
                    order.article.domain,
                    articleData,
                    options
                );
                console.log(`AI regeneration completed for order ${orderId}, got version ${generationResult.versionId}`);
            } catch (aiError) {
                console.error(`AI regeneration failed for order ${orderId}:`, aiError);
                throw new Error(`AI regeneration failed: ${aiError.message}`);
            }

            // Validate generation result
            if (!generationResult || !generationResult.versionId) {
                throw new Error('AI regeneration did not produce a valid version');
            }

            // Use a quick transaction only for the final database updates
            const result = await prisma.$transaction(async (tx) => {
                // Verify order still exists and get current state
                const currentOrder = await tx.order.findUnique({
                    where: { id: orderId }
                });

                if (!currentOrder) {
                    throw new Error(`Order ${orderId} no longer exists`);
                }

                // Update order to point to new version (articleId should not change in regeneration)
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        version_id: generationResult.versionId,
                        status: 'QUALITY_CHECK' // Reset to quality check for new version
                    }
                });

                return generationResult;
            }, {
                timeout: 10000 // 10 second timeout should be enough for simple DB updates
            });

            console.log(`Article regeneration completed for order ${orderId}, new version: ${result.versionId}`);
            return result;

        } catch (error) {
            console.error(`Failed to regenerate article for order ${orderId}:`, error);
            throw new Error(`Article regeneration failed: ${error.message}`);
        }
    }

    /**
     * Generate article using AI service (create complete article, not just add backlink)
     * @private
     */
    async _generateCustomerArticle(existingArticleId, domain, articleData, options = {}) {
        try {
            const { createVersionForArticle } = require('./articles/coreServices');
            
            // First check if this is a regeneration (article has existing versions)
            const existingVersions = await prisma.articleVersion.findMany({
                where: { article_id: existingArticleId },
                orderBy: { version_num: 'desc' },
                take: 1
            });

            if (existingVersions.length > 0) {
                // This is a regeneration - use createVersionForArticle
                const genParams = {
                    niche: articleData.niche,
                    keyword: articleData.keyword,
                    topic: articleData.topic,
                    n: 3, // Default number of sections
                    targetURL: articleData.targetURL,
                    anchorText: articleData.anchorText,
                    model: options.model || 'gemini-2.5-flash',
                    provider: options.provider || 'gemini',
                    internalLinkEnabled: true, // Enable internal linking for customer articles
                    noExternalBacklinks: !articleData.targetURL // Only add external backlink if provided
                };

                const result = await createVersionForArticle(existingArticleId, genParams, 3);

                // Update article metadata
                await prisma.article.update({
                    where: { id: existingArticleId },
                    data: {
                        topic: articleData.topic,
                        niche: articleData.niche,
                        keyword: articleData.keyword,
                        backlink_target: articleData.targetURL || null,
                        anchor: articleData.anchorText || null
                    }
                });

                return {
                    versionId: result.versionId,
                    versionNum: result.versionNum,
                    content: result.content,
                    previewContent: this._generatePreviewContent(result.content)
                };
            } else {
                // This is initial generation - use createVersionForArticle instead of deleting/recreating
                // Update the existing article first, then generate content
                await prisma.article.update({
                    where: { id: existingArticleId },
                    data: {
                        topic: articleData.topic,
                        niche: articleData.niche,
                        keyword: articleData.keyword,
                        backlink_target: articleData.targetURL || null,
                        anchor: articleData.anchorText || null,
                        status: 'DRAFT'
                    }
                });

                // Prepare generation parameters
                const genParams = {
                    niche: articleData.niche,
                    keyword: articleData.keyword,
                    topic: articleData.topic,
                    n: 3, // Default number of sections
                    targetURL: articleData.targetURL,
                    anchorText: articleData.anchorText,
                    model: options.model || 'gemini-2.5-flash',
                    provider: options.provider || 'gemini',
                    internalLinkEnabled: true, // Enable internal linking for customer articles
                    noExternalBacklinks: !articleData.targetURL // Only add external backlink if provided
                };

                // Use createVersionForArticle for consistency
                const result = await createVersionForArticle(existingArticleId, genParams, 3);

                return {
                    // Don't return articleId since we're using the existing article
                    versionId: result.versionId,
                    versionNum: result.versionNum,
                    content: result.content,
                    previewContent: this._generatePreviewContent(result.content)
                };
            }

        } catch (error) {
            throw new Error(`AI article generation failed: ${error.message}`);
        }
    }

    /**
     * Generate preview content (first 500 characters)
     * @private
     */
    _generatePreviewContent(content) {
        // Remove frontmatter
        const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
        
        // Get first paragraph after title
        const lines = contentWithoutFrontmatter.split('\n');
        const bodyLines = lines.filter(line => !line.startsWith('#') && line.trim().length > 0);
        const previewText = bodyLines.slice(0, 3).join(' ').substring(0, 500);
        
        return previewText + (previewText.length >= 500 ? '...' : '');
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