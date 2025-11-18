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

    try {
        const event = stripeService.constructWebhookEvent(req.body, sig);

        if (event.type === 'checkout.session.completed') {
            const checkoutSession = event.data.object;

            // Extract session ID from metadata
            const sessionId = checkoutSession.metadata.generation_session_id;

            if (!sessionId) {
                console.error('No generation_session_id in Stripe metadata');
                return res.status(400).json({ error: 'Missing session ID in metadata' });
            }

            // Complete payment and create orders
            const paymentData = {
                stripe_session_id: checkoutSession.id,
                amount: checkoutSession.amount_total / 100, // Convert cents to dollars
                currency: checkoutSession.currency,
                status: checkoutSession.payment_status
            };

            const result = await generationService.completeGenerationPayment(
                sessionId,
                checkoutSession.id,
                paymentData
            );

            // Queue all article generation jobs
            for (const order of result.orders) {
                const article = result.articles.find(a => a.articleId === order.articleId);
                const sessionDetails = await generationService.getGenerationSessionDetails(sessionId);
                const request = sessionDetails.generationRequests.find(r => 
                    r.topic === article.topic
                );

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

                console.log(`✅ Queued article generation for order ${order.orderId}`);
            }

            // Send bulk confirmation email
            await emailService.sendBulkGenerationConfirmation(
                sessionDetails.email,
                {
                    sessionId,
                    orders: result.orders,
                    totalPaid: paymentData.amount,
                    statusUrl: `${process.env.FRONTEND_URL}/bulk-generation-status?session_id=${sessionId}`
                }
            );

            console.log(`✅ Payment webhook processed - Session: ${sessionId}, Orders: ${result.orders.length}`);
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
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
