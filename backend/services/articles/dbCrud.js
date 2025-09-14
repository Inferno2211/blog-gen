const prisma = require('../../db/prisma');

async function createArticle(article) {
    return await prisma.article.create({ data: article });
}

async function getArticle(id) {
    const article = await prisma.article.findUnique({ 
        where: { id }, 
        include: { 
            versions: {
                orderBy: { version_num: 'desc' }
            }, 
            domain: true,
            selected_version: true
        } 
    });

    // If no selected_version but has versions, use the latest version as selected_version
    if (article && !article.selected_version && article.versions.length > 0) {
        article.selected_version = article.versions[0];
    }

    return article;
}

async function getAllArticles() {
    return await prisma.article.findMany({ 
        include: { 
            versions: {
                orderBy: {
                    version_num: 'desc'
                }
            }, 
            domain: true 
        } 
    });
}

async function updateArticle(id, data) {
    return await prisma.article.update({ where: { id }, data });
}

async function deleteArticle(id) {
    return await prisma.article.delete({ where: { id } });
}

async function setSelectedVersion(articleId, versionId) {
    return await prisma.article.update({
        where: { id: articleId },
        data: { selected_version_id: versionId }
    });
}

// Backlink review workflow methods
async function getBacklinkReviewQueue(status = 'PENDING_REVIEW', sortBy = 'created_at', sortOrder = 'desc') {
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    return await prisma.articleVersion.findMany({
        where: {
            backlink_review_status: status
        },
        include: {
            article: {
                include: {
                    domain: true,
                    selected_version: true
                }
            }
        },
        orderBy: orderBy
    });
}

async function approveBacklink(versionId, adminId, reviewNotes) {
    const version = await prisma.articleVersion.update({
        where: { id: versionId },
        data: {
            backlink_review_status: 'APPROVED',
            review_notes: reviewNotes,
            reviewed_by: adminId,
            reviewed_at: new Date()
        },
        include: {
            article: {
                include: {
                    domain: true
                }
            },
            orders: true
        }
    });

    // Send customer notifications for any associated orders
    try {
        const EmailService = require('../../EmailService');
        const emailService = new EmailService();
        
        for (const order of version.orders) {
            if (order.status === 'ADMIN_REVIEW') {
                // Update order status to completed (will be published separately)
                await prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'COMPLETED' }
                });
                
                console.log(`Order ${order.id} approved, customer will be notified when article is published`);
            }
        }
    } catch (error) {
        console.error('Failed to process order notifications for approved backlink:', error);
        // Don't fail the approval if notification fails
    }

    return {
        success: true,
        message: 'Backlink approved successfully',
        version: version
    };
}

async function rejectBacklink(versionId, adminId, reviewNotes) {
    const version = await prisma.articleVersion.update({
        where: { id: versionId },
        data: {
            backlink_review_status: 'REJECTED',
            review_notes: reviewNotes,
            reviewed_by: adminId,
            reviewed_at: new Date()
        },
        include: {
            article: {
                include: {
                    domain: true
                }
            },
            orders: true
        }
    });

    // Process refunds and notifications for any associated orders
    try {
        const EmailService = require('../../EmailService');
        const emailService = new EmailService();
        
        for (const order of version.orders) {
            if (order.status === 'ADMIN_REVIEW') {
                // Process refund through StripeService
                try {
                    const StripeService = require('../../StripeService');
                    const stripeService = new StripeService();
                    
                    const refundResult = await stripeService.processRefund(
                        order.id, 
                        reviewNotes || 'Backlink rejected during admin review'
                    );
                    
                    console.log(`Refund processed for rejected order ${order.id}:`, refundResult);
                    
                    // Send refund notification email
                    await emailService.sendRefundNotification(
                        order.customer_email,
                        order,
                        reviewNotes || 'Content quality standards not met'
                    );
                    
                } catch (refundError) {
                    console.error(`Failed to process refund for order ${order.id}:`, refundError);
                    // Continue with other orders even if one refund fails
                }
            }
        }
        
        // Update article availability back to available
        await prisma.article.update({
            where: { id: version.article_id },
            data: { availability_status: 'AVAILABLE' }
        });
        
    } catch (error) {
        console.error('Failed to process refunds for rejected backlink:', error);
        // Don't fail the rejection if refund processing fails
    }

    return {
        success: true,
        message: 'Backlink rejected successfully',
        version: version
    };
}

async function approveAndPublish(versionId, adminId, reviewNotes) {
    // First approve the backlink and get associated orders
    const approvedVersion = await prisma.articleVersion.update({
        where: { id: versionId },
        data: {
            backlink_review_status: 'APPROVED',
            review_notes: reviewNotes,
            reviewed_by: adminId,
            reviewed_at: new Date()
        },
        include: {
            orders: true,
            article: {
                include: {
                    domain: true
                }
            }
        }
    });

    // Then set it as the selected version
    await prisma.article.update({
        where: { id: approvedVersion.article_id },
        data: { selected_version_id: versionId }
    });

    // Finally publish the article using the coreServices
    try {
        const { addBlogToDomain } = require('./coreServices');
        const article = await getArticle(approvedVersion.article_id);
        
        if (!article.domain) {
            throw new Error('Article has no domain assigned');
        }
        
        const publishResult = await addBlogToDomain(approvedVersion.article_id, article.domain.slug);
        
        if (publishResult.success) {
            // Update article status to published and make available for new purchases
            await prisma.article.update({
                where: { id: approvedVersion.article_id },
                data: { 
                    status: 'PUBLISHED',
                    availability_status: 'AVAILABLE'
                }
            });
            
            // Complete orders and send customer notifications
            try {
                const EmailService = require('../../EmailService');
                const emailService = new EmailService();
                
                for (const order of approvedVersion.orders) {
                    if (order.status === 'ADMIN_REVIEW' || order.status === 'COMPLETED') {
                        // Mark order as completed with timestamp
                        await prisma.order.update({
                            where: { id: order.id },
                            data: { 
                                status: 'COMPLETED',
                                completed_at: new Date()
                            }
                        });
                        
                        // Send completion notification to customer
                        const articleData = {
                            title: article.slug,
                            slug: article.slug,
                            published_at: new Date(),
                            backlinkData: {
                                keyword: order.backlink_data.keyword,
                                targetUrl: order.backlink_data.target_url
                            }
                        };
                        
                        await emailService.sendCompletionNotification(
                            order.customer_email,
                            articleData
                        );
                        
                        console.log(`Order ${order.id} completed and customer notified`);
                    }
                }
            } catch (notificationError) {
                console.error('Failed to send customer notifications:', notificationError);
                // Don't fail the publish if notifications fail
            }
            
            return {
                success: true,
                message: 'Backlink approved and article published successfully',
                version: approvedVersion,
                publishResult: publishResult
            };
        } else {
            throw new Error(publishResult.message || 'Publishing failed');
        }
    } catch (error) {
        // If publishing fails, still return success for approval but include error info
        return {
            success: true,
            message: 'Backlink approved but publishing failed',
            version: approvedVersion,
            publishError: error.message,
            note: 'Article version is approved and selected. You may need to publish manually.'
        };
    }
}

// Browse articles for public homepage with availability status
async function getBrowseArticles() {
    const articles = await prisma.article.findMany({
        where: {
            status: 'PUBLISHED' // Only show published articles
        },
        select: {
            id: true,
            slug: true,
            topic: true,
            niche: true,
            keyword: true,
            availability_status: true,
            pending_backlink_count: true,
            last_backlink_added: true,
            created_at: true,
            selected_version_id: true,
            domain: {
                select: {
                    name: true,
                    slug: true
                }
            },
            selected_version: {
                select: {
                    id: true,
                    content_md: true,
                    created_at: true
                }
            },
            versions: {
                select: {
                    id: true,
                    content_md: true,
                    created_at: true,
                    version_num: true
                },
                orderBy: {
                    version_num: 'desc'
                },
                take: 1
            }
        },
        orderBy: {
            created_at: 'desc'
        }
    });

    // For each article, ensure we have content from either selected_version or latest version
    return articles.map(article => {
        let contentVersion = article.selected_version;
        
        // If no selected version or selected version has no content, use latest version
        if (!contentVersion || !contentVersion.content_md) {
            contentVersion = article.versions[0] || null;
        }
        
        return {
            ...article,
            selected_version: contentVersion,
            versions: undefined // Remove versions array from response
        };
    });
}

// Get article availability status
async function getArticleAvailability(articleId) {
    const article = await prisma.article.findUnique({
        where: { id: articleId },
        select: {
            id: true,
            availability_status: true,
            pending_backlink_count: true,
            status: true
        }
    });

    if (!article) {
        return { available: false, reason: 'Article not found' };
    }

    if (article.status !== 'PUBLISHED') {
        return { available: false, reason: 'Article not published' };
    }

    if (article.availability_status === 'SOLD_OUT') {
        return { available: false, reason: 'Article sold out - backlink pending review' };
    }

    if (article.availability_status === 'PROCESSING') {
        return { available: false, reason: 'Article currently being processed' };
    }

    return { available: true };
}

// Update article availability status
async function updateArticleAvailability(articleId, status) {
    return await prisma.article.update({
        where: { id: articleId },
        data: { 
            availability_status: status,
            updated_at: new Date()
        }
    });
}

// Generate article preview for homepage display
function generateArticlePreview(article) {
    if (!article.selected_version?.content_md) {
        // Generate a meaningful preview from article metadata
        const topicPreview = article.topic ? `Learn about ${article.topic}` : '';
        const nichePreview = article.niche ? ` in the ${article.niche} space` : '';
        const keywordPreview = article.keyword ? `. This article focuses on ${article.keyword}` : '';
        const fallbackPreview = `${topicPreview}${nichePreview}${keywordPreview}. Click to read the full article and discover valuable insights.`;
        
        return {
            id: article.id,
            slug: article.slug,
            title: article.topic || article.slug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Untitled Article',
            preview: fallbackPreview || 'Click to read this article and discover valuable insights.',
            availability_status: article.availability_status,
            domain: article.domain?.name || 'Unknown Domain',
            niche: article.niche,
            keyword: article.keyword,
            created_at: article.created_at,
            last_backlink_added: article.last_backlink_added
        };
    }

    const content = article.selected_version.content_md;
    
    // Extract title from markdown (first # heading or use topic)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : (article.topic || 'Untitled Article');
    
    // Generate preview text (first paragraph, max 200 chars)
    // Remove YAML frontmatter first
    let contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\s*/m, '').trim();
    
    // Remove title if present
    const contentWithoutTitle = contentWithoutFrontmatter.replace(/^#\s+.+$/m, '').trim();
    
    // Get first meaningful paragraph
    const paragraphs = contentWithoutTitle.split('\n\n').filter(p => p.trim().length > 0);
    const firstParagraph = paragraphs[0] || contentWithoutTitle.split('\n').find(line => line.trim().length > 0) || '';
    
    const cleanPreview = firstParagraph
        .replace(/[#*_`\[\]]/g, '') // Remove markdown formatting
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .trim();
    
    const preview = cleanPreview.length > 200 
        ? cleanPreview.substring(0, 200) + '...' 
        : cleanPreview;

    return {
        id: article.id,
        slug: article.slug,
        title: title,
        preview: preview || `Article about ${article.topic || article.niche || 'various topics'}. Click to learn more about ${article.keyword || 'this subject'}.`,
        availability_status: article.availability_status,
        domain: article.domain?.name || 'Unknown Domain',
        niche: article.niche,
        keyword: article.keyword,
        created_at: article.created_at,
        last_backlink_added: article.last_backlink_added
    };
}

module.exports = {
    createArticle,
    getArticle,
    getAllArticles,
    updateArticle,
    deleteArticle,
    setSelectedVersion,
    getBacklinkReviewQueue,
    approveBacklink,
    rejectBacklink,
    approveAndPublish,
    getBrowseArticles,
    getArticleAvailability,
    updateArticleAvailability,
    generateArticlePreview
};