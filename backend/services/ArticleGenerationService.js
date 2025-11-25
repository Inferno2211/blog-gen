const prisma = require('../db/prisma');
const EmailService = require('./EmailService');
const { ValidationError, ConflictError } = require('./errors');
const crypto = require('crypto');
const { extractFrontmatterTitle } = require('../utils/markdownUtils');

/**
 * ArticleGenerationService - Handles bulk article generation requests
 * Similar to PurchaseService but for generating new articles from scratch
 */
class ArticleGenerationService {
    constructor() {
        this.emailService = new EmailService();
    }

    /**
     * Initiate bulk article generation request
     * @param {Array} generationRequests - Array of { domainId, topic, niche, keyword, targetUrl, anchorText, notes }
     * @param {string} email - Customer email
     * @returns {Promise<{sessionId: string, magicLinkToken: string, cartSize: number}>}
     */
    async initiateBulkGeneration(generationRequests, email) {
        // Validate inputs
        if (!Array.isArray(generationRequests) || generationRequests.length === 0) {
            throw new Error('Generation requests must be a non-empty array');
        }

        if (generationRequests.length > 20) {
            throw new Error('Maximum 20 articles per generation request');
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Validate each request
        for (const req of generationRequests) {
            this._validateGenerationRequest(req);
        }

        // Check for duplicate topics in same domain
        const domainTopicPairs = generationRequests.map(r => `${r.domainId}:${r.topic.toLowerCase().trim()}`);
        const uniquePairs = new Set(domainTopicPairs);
        if (uniquePairs.size !== domainTopicPairs.length) {
            throw new Error('Duplicate topics detected for the same domain in cart');
        }

        try {
            // Verify all domains exist
            const domainIds = [...new Set(generationRequests.map(r => r.domainId))];
            const domains = await prisma.domain.findMany({
                where: { id: { in: domainIds } }
            });

            if (domains.length !== domainIds.length) {
                throw new Error('One or more invalid domain IDs');
            }

            // Check for existing articles with same topic on same domain
            await this._validateTopicUniqueness(generationRequests);

            // Calculate total price ($25 per article)
            const pricePerArticle = 25.00;
            const totalPrice = generationRequests.length * pricePerArticle;

            // Prepare generation requests data
            const requestsData = generationRequests.map(req => ({
                domainId: req.domainId,
                topic: req.topic.trim(),
                niche: req.niche?.trim() || '',
                keyword: req.keyword?.trim() || '',
                targetUrl: req.targetUrl,
                anchorText: req.anchorText,
                notes: req.notes?.trim() || '',
                price: pricePerArticle
            }));

            // Create magic link token
            const magicLinkToken = this._generateMagicLinkToken();
            const magicLinkExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Create generation session
            const session = await prisma.articleGenerationSession.create({
                data: {
                    email: email.toLowerCase().trim(),
                    generation_requests: requestsData,
                    total_articles: generationRequests.length,
                    total_price: totalPrice,
                    status: 'PENDING_AUTH',
                    magic_link_token: magicLinkToken,
                    magic_link_expires: magicLinkExpires
                }
            });

            console.log(`Bulk article generation initiated - Session: ${session.id}, Articles: ${generationRequests.length}, Email: ${email}`);

            return {
                sessionId: session.id,
                magicLinkToken: magicLinkToken,
                cartSize: generationRequests.length,
                totalPrice: totalPrice
            };

        } catch (error) {
            console.error('Failed to initiate bulk article generation:', error);

            // If this is a validation or conflict error, rethrow so controllers can generate a clear 400/409
            if (error instanceof ValidationError || error instanceof ConflictError) {
                throw error;
            }

            throw new Error(`Failed to initiate bulk article generation: ${error.message}`);
        }
    }

    /**
     * Get generation session details (for cart review before payment)
     * @param {string} sessionId - Generation session ID
     * @returns {Promise<Object>} Session with populated domain details
     */
    async getGenerationSessionDetails(sessionId) {
        const session = await prisma.articleGenerationSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            throw new Error('Generation session not found');
        }

        // Populate domain details for each request
        const requests = session.generation_requests;
        const domainIds = [...new Set(requests.map(r => r.domainId))];

        const domains = await prisma.domain.findMany({
            where: { id: { in: domainIds } },
            select: {
                id: true,
                name: true,
                slug: true,
                domain_rating: true,
                domain_age: true,
                categories: true
            }
        });

        const domainMap = {};
        domains.forEach(d => {
            domainMap[d.id] = d;
        });

        // Enrich requests with domain info
        const enrichedRequests = requests.map(req => ({
            ...req,
            domain: domainMap[req.domainId]
        }));

        return {
            sessionId: session.id,
            email: session.email,
            generationRequests: enrichedRequests,
            totalArticles: session.total_articles,
            totalPrice: session.total_price,
            status: session.status,
            createdAt: session.created_at
        };
    }

    /**
     * Complete payment and create article generation orders
     * @param {string} sessionId - Generation session ID
     * @param {string} stripeSessionId - Stripe checkout session ID
     * @param {Object} paymentData - Payment details from Stripe
     * @returns {Promise<{orders: Array}>}
     */
    async completeGenerationPayment(sessionId, stripeSessionId, paymentData) {
        try {
            // Fetch generation session
            const session = await prisma.articleGenerationSession.findUnique({
                where: { id: sessionId }
            });

            if (!session) {
                throw new Error('Generation session not found');
            }

            // Fetch orders separately - generation orders use backlink_data.generation_session_id
            const sessionOrders = await prisma.order.findMany({
                where: {
                    backlink_data: {
                        path: ['generation_session_id'],
                        equals: sessionId
                    }
                }
            });
            session.orders = sessionOrders;

            // Check if payment already processed (idempotency)
            if (session.stripe_session_id === stripeSessionId && session.orders.length > 0) {
                console.log(`Payment already processed for session ${sessionId}, returning existing orders`);

                // Fetch articles for existing orders
                const articleIds = session.orders.map(o => o.article_id);
                const articles = await prisma.article.findMany({
                    where: { id: { in: articleIds } },
                    select: { id: true, slug: true, topic: true }
                });

                return {
                    orders: session.orders.map(o => ({
                        orderId: o.id,
                        articleId: o.article_id,
                        status: o.status
                    })),
                    articles: articles.map(a => ({
                        articleId: a.id,
                        slug: a.slug,
                        topic: a.topic
                    })),
                    alreadyProcessed: true
                };
            }

            // Parse generation_requests from JSON (Prisma should auto-parse, but ensure it's an array)
            let generationRequests = session.generation_requests;
            if (!Array.isArray(generationRequests)) {
                // If it's a string, parse it
                if (typeof generationRequests === 'string') {
                    generationRequests = JSON.parse(generationRequests);
                } else if (!generationRequests) {
                    throw new Error('Generation session has no generation requests');
                }
            }

            if (!generationRequests || generationRequests.length === 0) {
                throw new Error('Generation session has no generation requests');
            }

            console.log(`Processing payment for session ${sessionId} with ${generationRequests.length} requests`);

            // Validate topic uniqueness again (race condition protection)
            await this._validateTopicUniqueness(generationRequests);

            const orders = [];
            const createdArticles = [];

            // Use transaction for atomic article + order creation
            await prisma.$transaction(async (tx) => {
                // Update session status and stripe_session_id
                await tx.articleGenerationSession.update({
                    where: { id: sessionId },
                    data: {
                        status: 'PAID',
                        stripe_session_id: stripeSessionId,
                        updated_at: new Date()
                    }
                });

                console.log(`Creating ${generationRequests.length} articles and orders for session ${sessionId}`);

                // Create article + order for each request
                for (let i = 0; i < generationRequests.length; i++) {
                    const request = generationRequests[i];

                    try {
                        console.log(`Processing request ${i + 1}/${generationRequests.length}: ${request.topic}`);
                        // Create draft article
                        const article = await tx.article.create({
                            data: {
                                domain_id: request.domainId,
                                slug: this._generateSlug(request.topic),
                                topic: request.topic,
                                niche: request.niche || '',
                                keyword: request.keyword || '',
                                backlink_target: request.targetUrl,
                                anchor: request.anchorText,
                                status: 'DRAFT',
                                availability_status: 'PROCESSING'
                            }
                        });

                        createdArticles.push(article);

                        // Create order with ARTICLE_GENERATION type (no session_id for generation orders)
                        const order = await tx.order.create({
                            data: {
                                session_id: null, // Generation orders don't link to PurchaseSession
                                session_type: 'GENERATION',
                                article_id: article.id,
                                customer_email: session.email,
                                backlink_data: {
                                    type: 'ARTICLE_GENERATION',
                                    keyword: request.anchorText,
                                    target_url: request.targetUrl,
                                    notes: request.notes || '',
                                    topic: request.topic,
                                    niche: request.niche || '',
                                    domainId: request.domainId,
                                    generation_session_id: sessionId // Track generation session in metadata
                                },
                                payment_data: paymentData,
                                stripe_session_id: stripeSessionId,
                                status: 'PROCESSING'
                            }
                        });

                        orders.push(order);

                        // Create generation request record
                        await tx.articleGenerationRequest.create({
                            data: {
                                session_id: sessionId,
                                domain_id: request.domainId,
                                topic: request.topic,
                                niche: request.niche || '',
                                keyword: request.keyword || '',
                                target_url: request.targetUrl,
                                anchor_text: request.anchorText,
                                notes: request.notes || '',
                                price: request.price,
                                article_id: article.id,
                                order_id: order.id,
                                status: 'PROCESSING'
                            }
                        });

                        console.log(`✅ Created article ${article.id} and order ${order.id} for topic: ${request.topic}`);
                    } catch (requestError) {
                        console.error(`❌ Failed to process request ${i + 1} (${request.topic}):`, requestError);
                        throw requestError; // Re-throw to rollback transaction
                    }
                }
            });

            console.log(`✅ Payment completed - Session: ${sessionId}, Orders created: ${orders.length}`);

            return {
                orders: orders.map(o => ({
                    orderId: o.id,
                    articleId: o.article_id,
                    status: o.status
                })),
                articles: createdArticles.map(a => ({
                    articleId: a.id,
                    slug: a.slug,
                    topic: a.topic
                }))
            };

        } catch (error) {
            console.error('Failed to complete generation payment:', error);

            // Handle duplicate topic error gracefully
            if (error.code === 'P2002') {
                throw new Error('One or more articles with these topics already exist on the selected domains');
            }

            throw new Error(`Failed to complete payment: ${error.message}`);
        }
    }

    /**
     * Get bulk generation status (all orders in a session)
     * @param {string} sessionId - Generation session ID
     * @returns {Promise<Object>} Session status with all orders
     */
    async getBulkGenerationStatus(sessionId) {
        const session = await prisma.articleGenerationSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            throw new Error('Generation session not found');
        }

        const fetchedOrders = await prisma.order.findMany({
            where: {
                backlink_data: {
                    path: ['generation_session_id'],
                    equals: sessionId
                }
            },
            include: {
                article: {
                    include: {
                        domain: {
                            select: {
                                id: true,
                                name: true,
                                slug: true
                            }
                        },
                        selected_version: {
                            select: {
                                id: true,
                                content_md: true,
                                last_qc_status: true,
                                backlink_review_status: true
                            }
                        }
                    }
                }
            },
            orderBy: { created_at: 'asc' }
        });

        // Format orders to match frontend expectations
        const orders = fetchedOrders.map(order => {
            const backlinkData = order.backlink_data || {};

            // Extract title from selected_version content if available
            let articleTitle = order.article?.topic || 'Untitled';
            if (order.article?.selected_version?.content_md) {
                const extractedTitle = extractFrontmatterTitle(order.article.selected_version.content_md);
                if (extractedTitle) {
                    // Remove quotes if present
                    articleTitle = extractedTitle.replace(/^["']|["']$/g, '');
                }
            }

            return {
                id: order.id,
                status: order.status,
                created_at: order.created_at,
                completed_at: order.completed_at,
                article: order.article ? {
                    id: order.article.id,
                    slug: order.article.slug,
                    status: order.article.status,
                    domain: order.article.domain ? {
                        id: order.article.domain.id,
                        name: order.article.domain.name,
                        slug: order.article.domain.slug
                    } : null,
                    selected_version: order.article.selected_version ? {
                        id: order.article.selected_version.id,
                        title: articleTitle,
                        last_qc_status: order.article.selected_version.last_qc_status,
                        backlink_review_status: order.article.selected_version.backlink_review_status
                    } : null
                } : null,
                backlink_data: {
                    topic: backlinkData.topic || order.article?.topic || '',
                    niche: backlinkData.niche || order.article?.niche || null,
                    keyword: backlinkData.keyword || order.article?.keyword || null,
                    targetUrl: backlinkData.target_url || order.article?.backlink_target || '',
                    anchorText: order.article?.anchor || backlinkData.keyword || '',
                    notes: backlinkData.notes || null
                }
            };
        });

        const completedOrders = orders.filter(o => o.status === 'COMPLETED').length;
        const failedOrders = orders.filter(o => o.status === 'FAILED').length;

        return {
            session: {
                id: session.id,
                email: session.email,
                status: session.status,
                created_at: session.created_at
            },
            orders: orders,
            totalOrders: orders.length
        };
    }

    /**
     * Validate a single generation request
     */
    _validateGenerationRequest(request) {
        if (!request.domainId || !request.topic || !request.targetUrl || !request.anchorText) {
            throw new Error('Each generation request must have domainId, topic, targetUrl, and anchorText');
        }

        // Validate target URL
        try {
            new URL(request.targetUrl);
        } catch {
            throw new Error(`Invalid target URL: ${request.targetUrl}`);
        }

        // Validate topic length
        if (request.topic.length < 3 || request.topic.length > 200) {
            throw new Error('Topic must be between 3 and 200 characters');
        }
    }

    /**
     * Validate topic uniqueness across domains (prevent duplicate articles)
     */
    async _validateTopicUniqueness(requests) {
        for (const request of requests) {
            const normalizedTopic = request.topic.toLowerCase().trim();

            // Check if article with this topic already exists on this domain
            const existing = await prisma.article.findFirst({
                where: {
                    domain_id: request.domainId,
                    topic: {
                        equals: normalizedTopic,
                        mode: 'insensitive'
                    }
                }
            });

            if (existing) {
                // Use a ValidationError so the HTTP error handler returns a 400 to the client
                throw new ValidationError(`Article with topic "${request.topic}" already exists on this domain`);
            }
        }
    }

    /**
     * Generate unique slug from topic
     */
    _generateSlug(topic) {
        const baseSlug = topic
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        const randomSuffix = crypto.randomBytes(4).toString('hex');
        return `${baseSlug}-${randomSuffix}`;
    }

    /**
     * Generate magic link token
     */
    _generateMagicLinkToken() {
        return crypto.randomBytes(32).toString('hex');
    }
}

module.exports = ArticleGenerationService;
