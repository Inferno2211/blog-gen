const prisma = require('../../../db/prisma');
const coreServices = require('../../articles/coreServices');
const EmailService = require('../../EmailService');

/**
 * Scheduled Publish Job Processor
 * Publishes an ArticleVersion at its scheduled time unless admin explicitly rejected it
 */
async function processScheduledPublish(job) {
    const { versionId, orderId, articleId, domainName: jobDomainName, scheduledAt, retryCount = 0 } = job.data;

    console.log('╔═══════════════════════════════════════════════════════════════');
    console.log('║ 📅 SCHEDULED PUBLISH JOB STARTED');
    console.log('╠═══════════════════════════════════════════════════════════════');
    console.log(`║ Job ID: ${job.id}`);
    console.log(`║ Version ID: ${versionId}`);
    console.log(`║ Order ID: ${orderId}`);
    console.log(`║ Article ID: ${articleId}`);
    console.log(`║ Domain: ${jobDomainName || 'Pending Resolution'}`);
    console.log(`║ Scheduled At: ${new Date(scheduledAt).toISOString()}`);
    console.log(`║ Retry Count: ${retryCount}`);
    console.log('╚═══════════════════════════════════════════════════════════════\n');

    try {
        // Load version with all necessary relations
        const version = await prisma.articleVersion.findUnique({
            where: { id: versionId },
            include: {
                article: {
                    include: {
                        domain: true
                    }
                },
                orders: true
            }
        });

        if (!version) {
            throw new Error(`ArticleVersion ${versionId} not found`);
        }

        // Resolve domain name
        const domainName = jobDomainName || version.article.domain?.slug;
        if (!domainName) {
            throw new Error('Could not resolve domain name for article');
        }

        // Validate scheduled status
        if (version.scheduled_status !== 'SCHEDULED') {
            console.log(`⚠️  Version ${versionId} is not in SCHEDULED status (current: ${version.scheduled_status})`);
            return {
                success: false,
                reason: 'Not in SCHEDULED status',
                currentStatus: version.scheduled_status
            };
        }

        const order = version.orders.find(o => o.id === orderId);

        // Check for explicit admin rejection
        const isRejected = version.backlink_review_status === 'REJECTED';
        const orderFailed = order && (order.status === 'FAILED' || order.status === 'REFUNDED');

        if (isRejected || orderFailed) {
            console.log(`❌ Version ${versionId} was explicitly rejected by admin. Cancelling scheduled publish.`);
            
            // Update version status to CANCELLED
            await prisma.articleVersion.update({
                where: { id: versionId },
                data: {
                    scheduled_status: 'CANCELLED',
                    scheduled_job_id: null
                }
            });

            // Update order status
            if (order) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        scheduled_status: 'CANCELLED',
                        status: 'FAILED'
                    }
                });
            }

            // Reset article availability
            await prisma.article.update({
                where: { id: articleId },
                data: {
                    availability_status: 'AVAILABLE'
                }
            });

            // Notify customer
            const emailService = new EmailService();
            try {
                await emailService.sendScheduleCancelledEmail(order.customer_email, {
                    orderId,
                    articleId,
                    reason: 'Article was rejected by admin during review'
                });
            } catch (emailError) {
                console.error('Failed to send cancellation email:', emailError.message);
            }

            return {
                success: false,
                reason: 'Rejected by admin',
                cancelled: true
            };
        }

        // Check idempotency - already published?
        if (version.article.selected_version_id === versionId && version.article.status === 'PUBLISHED') {
            console.log(`✅ Version ${versionId} already published. Marking as executed.`);
            
            await prisma.articleVersion.update({
                where: { id: versionId },
                data: {
                    scheduled_status: 'EXECUTED',
                    scheduled_job_id: null
                }
            });

            if (order) {
                await prisma.order.update({
                    where: { id: orderId },
                    data: { scheduled_status: 'EXECUTED' }
                });
            }

            return {
                success: true,
                alreadyPublished: true
            };
        }

        job.progress(20);

        // Set selected version BEFORE publishing (required by addBlogToDomain)
        console.log(`🔗 Setting selected version...`);
        await prisma.article.update({
            where: { id: articleId },
            data: { selected_version_id: versionId }
        });

        job.progress(30);

        // Publish the article version to domain
        console.log(`📝 Publishing version ${versionId} to domain ${domainName}...`);
        const publishResult = await coreServices.addBlogToDomain(articleId, domainName);

        if (!publishResult.success) {
            throw new Error(`Failed to publish article: ${publishResult.message}`);
        }

        job.progress(60);

        // Update database in transaction
        console.log(`💾 Updating database records...`);
        await prisma.$transaction(async (tx) => {
            // Determine expiration settings based on order type
            let updateData = {
                status: 'PUBLISHED',
                availability_status: 'AVAILABLE'
            };

            // Check if this is a backlink purchase (Scenario 1 & 2)
            const backlinkOrder = order && order.session_type === 'PURCHASE' ? order : null;
            
            if (backlinkOrder) {
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiration

                updateData = {
                    ...updateData,
                    availability_status: 'SOLD_OUT', // Exclusive
                    backlink_expiry_date: expiryDate,
                    original_version_id: version.article.selected_version_id, // Previous version (captured before update)
                    active_order_id: backlinkOrder.id
                };
            }

            // Update article status (selected_version_id already set above)
            await tx.article.update({
                where: { id: articleId },
                data: updateData
            });

            // Update version
            await tx.articleVersion.update({
                where: { id: versionId },
                data: {
                    scheduled_status: 'EXECUTED',
                    scheduled_job_id: null
                }
            });

            // Update order
            if (order) {
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'COMPLETED',
                        completed_at: new Date(),
                        scheduled_status: 'EXECUTED'
                    }
                });
            }
        });

        job.progress(90);

        // Send notification email
        console.log(`📧 Sending publication notification...`);
        const emailService = new EmailService();
        try {
            await emailService.sendArticlePublishedEmail(order.customer_email, {
                orderId,
                articleId,
                articleTitle: version.article.topic || version.article.slug,
                articleUrl: `${version.article.domain.url || domainName}/posts/${version.article.slug}`,
                publishedAt: new Date()
            });
        } catch (emailError) {
            console.error('Failed to send publication email:', emailError.message);
        }

        job.progress(100);

        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ ✅ SCHEDULED PUBLISH JOB COMPLETED');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log(`║ Version ID: ${versionId}`);
        console.log(`║ Article URL: ${publishResult.filePath}`);
        console.log('╚═══════════════════════════════════════════════════════════════\n');

        return {
            success: true,
            versionId,
            orderId,
            articleId,
            publishedAt: new Date(),
            filePath: publishResult.filePath
        };

    } catch (error) {
        console.log('╔═══════════════════════════════════════════════════════════════');
        console.log('║ ❌ SCHEDULED PUBLISH JOB FAILED');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log(`║ Version ID: ${versionId}`);
        console.log(`║ Error: ${error.message}`);
        console.log('╚═══════════════════════════════════════════════════════════════\n');
        console.error('Stack trace:', error.stack);

        // Mark schedule as failed
        try {
            await prisma.articleVersion.update({
                where: { id: versionId },
                data: {
                    scheduled_status: 'CANCELLED',
                    scheduled_job_id: null
                }
            });

            if (orderId) {
                const order = await prisma.order.findUnique({ where: { id: orderId } });
                if (order) {
                    await prisma.order.update({
                        where: { id: orderId },
                        data: {
                            scheduled_status: 'CANCELLED',
                            status: 'FAILED'
                        }
                    });

                    // Notify customer of failure
                    const emailService = new EmailService();
                    try {
                        await emailService.sendScheduleFailedEmail(order.customer_email, {
                            orderId,
                            error: error.message
                        });
                    } catch (emailError) {
                        console.error('Failed to send failure email:', emailError.message);
                    }
                }
            }
        } catch (updateError) {
            console.error('Failed to update status after error:', updateError.message);
        }

        throw error;
    }
}

module.exports = processScheduledPublish;
