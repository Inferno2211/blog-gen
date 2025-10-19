const prisma = require('../../../db/prisma');
const aiService = require('../../articles/aiService');
const coreServices = require('../../articles/coreServices');
const EmailService = require('../../EmailService');

/**
 * Backlink Integration Job Processor
 * Handles jobs for integrating customer backlinks into existing articles
 * Always uses the currently PUBLISHED article as the base context
 */
async function processBacklinkIntegration(job) {
    const { orderId, articleId, targetUrl, anchorText, notes, email, isRegeneration } = job.data;

    console.log(`Processing backlink ${isRegeneration ? 'regeneration' : 'integration'} for order ${orderId}, article ${articleId}`);

    try {
        // Update order status to processing
        await prisma.order.update({
            where: { id: orderId },
            data: { 
                status: 'PROCESSING',
                updated_at: new Date()
            }
        });

        job.progress(10);

        // Get article with PUBLISHED version (not customer's previous attempt)
        // This ensures we always use the live article as the base
        const article = await prisma.article.findUnique({
            where: { id: articleId },
            include: {
                selected_version: true, // This is the PUBLISHED version
                domain: {
                    include: {
                        articles: {
                            where: { status: 'PUBLISHED' },
                            select: { slug: true, topic: true }
                        }
                    }
                }
            }
        });

        if (!article) {
            throw new Error(`Article ${articleId} not found`);
        }

        if (!article.selected_version) {
            throw new Error(`Article ${articleId} has no published content`);
        }

        job.progress(20);

        // Delegate backlink integration to BacklinkService which reuses admin logic
        const BacklinkService = require('../../BacklinkService');
        const backlinkSvc = new BacklinkService();

        job.progress(30);

        const integrateResult = await backlinkSvc.integrateBacklink(articleId, targetUrl, anchorText, {
            model: job.data.model || 'gemini-2.5-flash',
            provider: job.data.provider || 'gemini',
            runQualityCheck: true
        });

        // integrateResult contains: { versionId, versionNum, content, previewContent }

        // Update order with version and move to quality check status
        await prisma.order.update({
            where: { id: orderId },
            data: {
                version_id: integrateResult.versionId,
                status: 'QUALITY_CHECK',
                updated_at: new Date()
            }
        });

        job.progress(95);

        // Send email notification
        const emailService = new EmailService();
        if (isRegeneration) {
            await emailService.sendRevisionReadyEmail(email, {
                orderId,
                articleId,
                articleSlug: article.slug,
                viewUrl: `${process.env.FRONTEND_URL}/order-status?order_id=${orderId}`
            });
        } else {
            await emailService.sendBacklinkIntegratedEmail(email, {
                orderId,
                articleId,
                articleSlug: article.slug,
                viewUrl: `${process.env.FRONTEND_URL}/order-status?order_id=${orderId}`
            });
        }

        job.progress(100);

        console.log(`Backlink ${isRegeneration ? 'regeneration' : 'integration'} completed for order ${orderId}`);

        return {
            success: true,
            orderId,
            articleId,
            versionId: integrateResult.versionId,
            qcPassed: true,
            qcAttempts: 1
        };

    } catch (error) {
        console.error(`Backlink integration failed for order ${orderId}:`, error);

        // Update order status to failed
        await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'FAILED',
                updated_at: new Date()
            }
        });

        // Send failure notification
        const emailService = new EmailService();
        await emailService.sendOrderFailedEmail(email, {
            orderId,
            error: error.message
        });

        throw error;
    }
}

/**
 * Get regeneration count for an order
 * @param {string} orderId - Order ID
 * @returns {Promise<number>} Number of times this order has been regenerated
 */
async function getRegenerationCount(orderId) {
    const versions = await prisma.articleVersion.findMany({
        where: {
            orders: {
                some: {
                    id: orderId
                }
            },
            backlink_metadata: {
                path: ['integration_type'],
                string_contains: 'regeneration'
            }
        }
    });
    
    return versions.length;
}

module.exports = processBacklinkIntegration;
