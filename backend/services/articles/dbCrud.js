const prisma = require('../../db/prisma');

async function createArticle(article) {
    return await prisma.article.create({ data: article });
}

async function getArticle(id) {
    return await prisma.article.findUnique({ where: { id }, include: { versions: true, domain: true } });
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
            }
        }
    });

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
            }
        }
    });

    return {
        success: true,
        message: 'Backlink rejected successfully',
        version: version
    };
}

async function approveAndPublish(versionId, adminId, reviewNotes) {
    // First approve the backlink
    const approvedVersion = await prisma.articleVersion.update({
        where: { id: versionId },
        data: {
            backlink_review_status: 'APPROVED',
            review_notes: reviewNotes,
            reviewed_by: adminId,
            reviewed_at: new Date()
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
            // Update article status to published
            await prisma.article.update({
                where: { id: approvedVersion.article_id },
                data: { status: 'PUBLISHED' }
            });
            
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
    return await prisma.article.findMany({
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
            }
        },
        orderBy: {
            created_at: 'desc'
        }
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
        return {
            id: article.id,
            slug: article.slug,
            title: article.topic || 'Untitled Article',
            preview: 'No content available',
            availability_status: article.availability_status,
            domain: article.domain?.name || 'Unknown Domain',
            created_at: article.created_at
        };
    }

    const content = article.selected_version.content_md;
    
    // Extract title from markdown (first # heading or use topic)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : (article.topic || 'Untitled Article');
    
    // Generate preview text (first paragraph, max 200 chars)
    const contentWithoutTitle = content.replace(/^#\s+.+$/m, '').trim();
    const firstParagraph = contentWithoutTitle.split('\n\n')[0] || contentWithoutTitle.split('\n')[0] || '';
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
        preview: preview || 'No preview available',
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