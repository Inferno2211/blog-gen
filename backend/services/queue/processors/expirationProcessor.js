const prisma = require('../../../db/prisma');
const coreServices = require('../../articles/coreServices');
const EmailService = require('../../EmailService');

/**
 * Expiration Check Processor
 * Runs daily to check for expiring backlinks and revert expired ones
 */
async function processExpirationCheck(job) {
    console.log('╔═══════════════════════════════════════════════════════════════');
    console.log('║ ⏰ EXPIRATION CHECK STARTED');
    console.log('╚═══════════════════════════════════════════════════════════════\n');

    const emailService = new EmailService();
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // 1. Reversion Logic (Expired + Grace Period)
    // Find articles where expiry date was more than 2 days ago
    const expiredArticles = await prisma.article.findMany({
        where: {
            backlink_expiry_date: {
                lt: twoDaysAgo
            },
            availability_status: 'SOLD_OUT',
            original_version_id: { not: null }
        },
        include: {
            domain: true
        }
    });

    console.log(`Found ${expiredArticles.length} articles to revert.`);

    for (const article of expiredArticles) {
        try {
            console.log(`Reverting article ${article.id} to version ${article.original_version_id}`);
            
            // Revert to original version
            await prisma.article.update({
                where: { id: article.id },
                data: { selected_version_id: article.original_version_id }
            });

            // Publish original content
            await coreServices.addBlogToDomain(article.id, article.domain.slug);

            // Reset status
            await prisma.article.update({
                where: { id: article.id },
                data: {
                    availability_status: 'AVAILABLE',
                    backlink_expiry_date: null,
                    original_version_id: null,
                    active_order_id: null
                }
            });

            // Notify user
            if (article.active_order_id) {
                const order = await prisma.order.findUnique({ where: { id: article.active_order_id } });
                if (order) {
                    await emailService.sendExpirationReverted(order.customer_email, {
                        articleTitle: article.topic || article.slug,
                        articleUrl: `${article.domain.url || article.domain.slug}/posts/${article.slug}`
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to revert article ${article.id}:`, error);
        }
    }

    // 2. Warning Logic (7 days)
    const startOf7Days = new Date(sevenDaysFromNow); startOf7Days.setHours(0,0,0,0);
    const endOf7Days = new Date(sevenDaysFromNow); endOf7Days.setHours(23,59,59,999);

    const warning7Days = await prisma.article.findMany({
        where: {
            backlink_expiry_date: {
                gte: startOf7Days,
                lte: endOf7Days
            },
            active_order_id: { not: null }
        }
    });

    console.log(`Found ${warning7Days.length} articles expiring in 7 days.`);

    for (const article of warning7Days) {
        const order = await prisma.order.findUnique({ where: { id: article.active_order_id } });
        if (order) {
             await emailService.sendExpirationWarning(order.customer_email, article, 7, order.id);
        }
    }

    // 3. Warning Logic (1 day)
    const startOf1Day = new Date(oneDayFromNow); startOf1Day.setHours(0,0,0,0);
    const endOf1Day = new Date(oneDayFromNow); endOf1Day.setHours(23,59,59,999);

    const warning1Day = await prisma.article.findMany({
        where: {
            backlink_expiry_date: {
                gte: startOf1Day,
                lte: endOf1Day
            },
            active_order_id: { not: null }
        }
    });

    console.log(`Found ${warning1Day.length} articles expiring in 1 day.`);

    for (const article of warning1Day) {
        const order = await prisma.order.findUnique({ where: { id: article.active_order_id } });
        if (order) {
             await emailService.sendExpirationWarning(order.customer_email, article, 1, order.id);
        }
    }

    return { success: true, reverted: expiredArticles.length, warnings: warning7Days.length + warning1Day.length };
}

module.exports = processExpirationCheck;
