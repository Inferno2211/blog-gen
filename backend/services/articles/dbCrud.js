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
    approveAndPublish
};