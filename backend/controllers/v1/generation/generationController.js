const ArticleGenerationService = require('../../../services/ArticleGenerationService');
const SessionService = require('../../../services/SessionService');
const StripeService = require('../../../services/StripeService');
const EmailService = require('../../../services/EmailService');
const QueueService = require('../../../services/queue/QueueService');

const generationService = new ArticleGenerationService();
const sessionService = new SessionService();
const stripeService = new StripeService();
const emailService = new EmailService();
const queueService = new QueueService();

/**
 * Initiate bulk article generation
 * POST /api/v1/generation/initiate-bulk
 */
async function initiateBulkGeneration(req, res) {
    try {
        const { generationRequests, email } = req.body;

        // Initiate generation session
        const result = await generationService.initiateBulkGeneration(generationRequests, email);

        // Send magic link email with cart summary
        const magicLink = `${process.env.FRONTEND_URL}/verify-generation?token=${result.magicLinkToken}`;

        await emailService.sendEmail(
            email,
            'Verify Your Article Generation Request',
            `
                <h2>Complete Your Article Generation Order</h2>
                <p>You've requested ${result.cartSize} article(s) to be generated.</p>
                <p><strong>Total Price:</strong> $${result.totalPrice.toFixed(2)}</p>
                <p>Click the link below to verify your email and proceed to payment:</p>
                <p><a href="${magicLink}">Verify Email & Continue to Payment</a></p>
                <p>This link expires in 24 hours.</p>
            `
        );

        res.status(200).json({
            success: true,
            sessionId: result.sessionId,
            cartSize: result.cartSize,
            totalPrice: result.totalPrice,
            message: 'Magic link sent to your email'
        });

    } catch (error) {
        console.error('Error initiating bulk generation:', error);
        res.status(400).json({
            error: error.message,
            code: 'GENERATION_INITIATION_FAILED'
        });
    }
}

/**
 * Get generation cart details
 * GET /api/v1/generation/cart/:sessionId
 */
async function getGenerationCart(req, res) {
    try {
        const { sessionId } = req.params;

        const cartDetails = await generationService.getGenerationSessionDetails(sessionId);

        res.status(200).json({
            success: true,
            ...cartDetails
        });

    } catch (error) {
        console.error('Error fetching generation cart:', error);
        res.status(404).json({
            error: error.message,
            code: 'CART_NOT_FOUND'
        });
    }
}

/**
 * Verify magic link and create Stripe checkout session
 * POST /api/v1/generation/verify-and-pay
 */
async function verifyAndCreateCheckout(req, res) {
    try {
        const { token } = req.body;

        // Verify magic link token
        const session = await sessionService.verifyGenerationMagicLink(token);

        if (!session) {
            return res.status(401).json({
                error: 'Invalid or expired magic link',
                code: 'INVALID_TOKEN'
            });
        }

        // Get session details
        const sessionDetails = await generationService.getGenerationSessionDetails(session.id);

        // If this session is already paid, return an indicator so frontend can redirect to status page
        if (session.status === 'PAID') {
            return res.status(200).json({
                success: true,
                sessionId: session.id,
                alreadyPaid: true,
                redirectUrl: `${process.env.FRONTEND_URL}/bulk-generation-status?session_id=${session.id}`
            });
        }

        // Create Stripe checkout session
        const checkoutSession = await stripeService.createGenerationCheckoutSession(
            session.id,
            sessionDetails.generationRequests,
            session.email
        );

        res.status(200).json({
            success: true,
            sessionId: session.id,
            stripeSessionId: checkoutSession.sessionId,
            checkoutUrl: checkoutSession.url
        });

    } catch (error) {
        console.error('Error verifying and creating checkout:', error);
        res.status(400).json({
            error: error.message,
            code: 'CHECKOUT_CREATION_FAILED'
        });
    }
}

/**
 * Get bulk generation status
 * GET /api/v1/generation/bulk-status/:sessionId
 */
async function getBulkGenerationStatus(req, res) {
    try {
        const { sessionId } = req.params;

        const status = await generationService.getBulkGenerationStatus(sessionId);

        res.status(200).json({
            success: true,
            ...status
        });

    } catch (error) {
        console.error('Error fetching bulk generation status:', error);
        res.status(404).json({
            error: error.message,
            code: 'STATUS_NOT_FOUND'
        });
    }
}

/**
 * Webhook handler for Stripe payment completion
 * POST /api/v1/generation/webhook
 */
async function handleGenerationWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const requestId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[${requestId}] Webhook received. Sig length: ${sig ? sig.length : 0}`);

    try {
        // Use generation-specific webhook secret if available, otherwise fall back to default
        const webhookSecret = process.env.STRIPE_GENERATION_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error(`[${requestId}] ❌ Webhook secret is missing from environment variables`);
            throw new Error('Webhook secret configuration missing');
        }

        console.log(`[${requestId}] Verifying signature with secret ending in ...${webhookSecret.slice(-4)}`);

        let event;
        try {
            event = stripeService.verifyWebhookSignature(req.body, sig, webhookSecret);
        } catch (err) {
            console.error(`[${requestId}] ❌ Webhook signature verification failed:`, err.message);
            throw err;
        }

        console.log(`[${requestId}] ✅ Webhook verified. Event type: ${event.type}, ID: ${event.id}`);

        if (event.type === 'checkout.session.completed') {
            const checkoutSession = event.data.object;
            console.log(`[${requestId}] Processing checkout.session.completed for session: ${checkoutSession.id}`);

            // Extract session ID from metadata
            const sessionId = checkoutSession.metadata?.generation_session_id;

            if (!sessionId) {
                console.error(`[${requestId}] ❌ No generation_session_id in Stripe metadata. Metadata received:`, JSON.stringify(checkoutSession.metadata));
                return res.status(400).json({ error: 'Missing session ID in metadata' });
            }

            console.log(`[${requestId}] Found generation session ID: ${sessionId}`);

            // Complete payment and create orders
            const paymentData = {
                stripe_session_id: checkoutSession.id,
                amount: checkoutSession.amount_total / 100, // Convert cents to dollars
                currency: checkoutSession.currency,
                status: checkoutSession.payment_status
            };

            let result;
            try {
                result = await generationService.completeGenerationPayment(
                    sessionId,
                    checkoutSession.id,
                    paymentData
                );
            } catch (paymentError) {
                console.error(`[${requestId}] ❌ Failed to complete generation payment logic:`, paymentError);
                // We return 200 to Stripe so they don't retry indefinitely if it's a logic error we can't fix with a retry
                // But we should probably alert/monitor this
                return res.status(500).json({ error: 'Internal processing error', details: paymentError.message });
            }

            // Skip queuing if already processed
            if (result.alreadyProcessed) {
                console.log(`[${requestId}] ⚠️ Payment already processed for session ${sessionId}, skipping queue`);
                return res.status(200).json({ received: true, alreadyProcessed: true });
            }

            console.log(`[${requestId}] Payment completed. Created ${result.orders.length} orders. Proceeding to queue jobs.`);

            // Get session details once (outside loop)
            const sessionDetails = await generationService.getGenerationSessionDetails(sessionId);

            // Create a map of articleId to article for quick lookup
            const articleMap = new Map();
            result.articles.forEach(article => {
                articleMap.set(article.articleId, article);
            });

            // Queue all article generation jobs
            let queuedCount = 0;
            for (const order of result.orders) {
                const article = articleMap.get(order.articleId);

                if (!article) {
                    console.error(`[${requestId}] ❌ Article not found for order ${order.orderId}`);
                    continue;
                }

                // Find the matching request by topic (should match since we just created them)
                const request = sessionDetails.generationRequests.find(r =>
                    r.topic === article.topic
                );

                if (!request) {
                    console.error(`[${requestId}] ❌ Generation request not found for article ${article.articleId} with topic ${article.topic}`);
                    continue;
                }

                try {
                    // Add to article generation queue
                    await queueService.addArticleGenerationJob({
                        orderId: order.orderId,
                        articleId: order.articleId,
                        domainId: request.domainId,
                        topic: request.topic,
                        niche: request.niche || '',
                        keyword: request.keyword || '',
                        targetUrl: request.targetUrl,
                        anchorText: request.anchorText,
                        email: sessionDetails.email,
                        isRegeneration: false
                    });

                    queuedCount++;
                    console.log(`[${requestId}] ✅ Queued article generation for order ${order.orderId}, article ${order.articleId}`);
                } catch (queueError) {
                    console.error(`[${requestId}] ❌ Failed to queue job for order ${order.orderId}:`, queueError);
                    // Continue with other orders even if one fails
                }
            }

            console.log(`[${requestId}] Queuing complete. ${queuedCount}/${result.orders.length} jobs queued.`);

            // Send bulk confirmation email
            try {
                await emailService.sendBulkGenerationConfirmation(
                    sessionDetails.email,
                    {
                        sessionId,
                        orders: result.orders,
                        totalPaid: paymentData.amount,
                        statusUrl: `${process.env.FRONTEND_URL}/bulk-generation-status?session_id=${sessionId}`
                    }
                );
                console.log(`[${requestId}] ✅ Sent confirmation email to ${sessionDetails.email}`);
            } catch (emailError) {
                console.error(`[${requestId}] ❌ Failed to send confirmation email:`, emailError);
                // Don't fail the webhook if email fails
            }

            console.log(`[${requestId}] ✅ Payment webhook fully processed - Session: ${sessionId}`);
        } else {
            console.log(`[${requestId}] Ignoring event type: ${event.type}`);
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error(`[${requestId}] ❌ Critical Webhook error:`, error);
        res.status(400).json({ error: error.message });
    }
}

module.exports = {
    initiateBulkGeneration,
    getGenerationCart,
    verifyAndCreateCheckout,
    getBulkGenerationStatus,
    handleGenerationWebhook
};
