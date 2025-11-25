const prisma = require('../../../db/prisma');
const aiService = require('../../articles/aiService');
const coreServices = require('../../articles/coreServices');
const EmailService = require('../../EmailService');

/**
 * Article Generation Job Processor
 * Handles jobs for generating new articles from scratch
 */
async function processArticleGeneration(job) {
    const { orderId, articleId, domainId, topic, niche, keyword, targetUrl, anchorText, email, isRegeneration = false } = job.data;

    console.log('╔═══════════════════════════════════════════════════════════════');
    console.log('║ 🚀 ARTICLE GENERATION JOB STARTED');
    console.log('╠═══════════════════════════════════════════════════════════════');
    console.log(`║ Job ID: ${job.id}`);
    console.log(`║ Order ID: ${orderId}`);
    console.log(`║ Article ID: ${articleId}`);
    console.log(`║ Domain ID: ${domainId}`);
    console.log(`║ Topic: ${topic}`);
    console.log(`║ Niche: ${niche}`);
    console.log(`║ Keyword: ${keyword}`);
    console.log(`║ Target URL: ${targetUrl}`);
    console.log(`║ Anchor Text: ${anchorText}`);
    console.log(`║ Email: ${email}`);
    console.log(`║ Is Regeneration: ${isRegeneration}`);
    console.log('╚═══════════════════════════════════════════════════════════════\n');

    try {
        // Update order status to processing
        console.log(`📝 Updating order ${orderId} status to PROCESSING...`);
        await prisma.order.update({
            where: { id: orderId },
            data: { 
                status: 'PROCESSING',
                updated_at: new Date()
            }
        });
        console.log('✅ Order status updated to PROCESSING\n');

        // Report progress
        job.progress(10);

        // Get domain info for internal links
        console.log(`🔍 Fetching domain ${domainId} information...`);
        const domain = await prisma.domain.findUnique({
            where: { id: domainId },
            include: {
                articles: {
                    where: { status: 'PUBLISHED' },
                    select: { slug: true, topic: true }
                }
            }
        });

        if (!domain) {
            throw new Error(`Domain ${domainId} not found`);
        }
        console.log(`✅ Domain found: ${domain.name} (${domain.articles.length} published articles)\n`);

        job.progress(20);

        // Prepare internal link candidates
        const internalLinkCandidates = domain.articles.map(a => ({
            title: a.topic || a.slug,
            slug: a.slug
        }));
        console.log(`🔗 Prepared ${internalLinkCandidates.length} internal link candidates\n`);

        // Delegate generation to shared admin pipeline which handles generation + QC + saving
        console.log('ℹ️  Delegating generation to admin service: createVersionForArticle');

        const genParams = {
            userPrompt: null,
            isCustomPrompt: false,
            internalLinkEnabled: internalLinkCandidates && internalLinkCandidates.length > 0,
            noExternalBacklinks: false, // include backlink as requested by customer
            niche,
            keyword,
            topic,
            n: 1,
            model: job.data.model || 'gemini-2.5-flash',
            provider: job.data.provider || 'gemini'
        };

        // Call core service to generate QC'd version
        const result = await coreServices.createVersionForArticle(articleId, genParams, 3);

        job.progress(90);

        // Update article's selected_version_id so the version is accessible via article.selected_version
        console.log(`🔗 Setting Article.selected_version_id to ${result.versionId}...`);
        await prisma.article.update({
            where: { id: articleId },
            data: {
                selected_version_id: result.versionId,
                updated_at: new Date()
            }
        });
        console.log('✅ Article.selected_version_id updated\n');

        // Update order with returned version and move to quality check status
        await prisma.order.update({
            where: { id: orderId },
            data: {
                version_id: result.versionId,
                status: 'QUALITY_CHECK',
                updated_at: new Date()
            }
        });

        job.progress(95);

        // Send email notification to customer
        console.log('📧 Sending email notification to customer...');
        const emailService = new EmailService();
        
        if (isRegeneration) {
            // For regenerations, use revision ready email
            await emailService.sendRevisionReadyEmail(email, {
                orderId,
                articleId,
                viewUrl: `${process.env.FRONTEND_URL}/order-status?order_id=${orderId}`
            });
        } else {
            // For initial generation, use article ready email
            await emailService.sendArticleReadyEmail(email, {
                orderId,
                articleId,
                topic,
                viewUrl: `${process.env.FRONTEND_URL}/order-status?order_id=${orderId}`
            });
        }
        console.log('✅ Email sent successfully\n');

        job.progress(100);

        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ ✅ ARTICLE GENERATION JOB COMPLETED (via admin service)');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log(`║ Order ID: ${orderId}`);
        console.log(`║ Article ID: ${articleId}`);
        console.log(`║ Version ID: ${result.versionId}`);
        console.log(`║ QC Status: ${result.status}`);
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        return {
            success: true,
            orderId,
            articleId,
            versionId: result.versionId,
            qcPassed: result.status === 'passed',
            qcAttempts: result.qcResult?.attempts || 0
        };

    } catch (error) {
        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ ❌ ARTICLE GENERATION JOB FAILED');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log(`║ Order ID: ${orderId}`);
        console.log(`║ Error: ${error.message}`);
        console.log('╚═══════════════════════════════════════════════════════════════\n');
        console.error('Stack trace:', error.stack);

        // Update order status to failed
        try {
            await prisma.order.update({
                where: { id: orderId },
                data: { status: 'FAILED', updated_at: new Date() }
            });
        } catch (e) {
            console.error('Failed to update order status to FAILED:', e.message);
        }

        // Send failure notification
        try {
            const emailService = new EmailService();
            await emailService.sendOrderFailedEmail(email, {
                orderId,
                error: error.message
            });
        } catch (e) {
            console.error('Failed to send failure email:', e.message);
        }

        throw error;
    }
}

module.exports = processArticleGeneration;
