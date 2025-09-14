const { addBlogToDomain, updateBlogInDomain, createVersionFromEditor, createVersionFromEditorDirect } = require('../../../services/articles/coreServices');
const articleService = require('../../../services/articles/dbCrud');
// Alias service-layer functions to avoid name collisions with controller handlers
const {
    publishArticle,
    editArticleContent: editArticleContentService,
    updatePublishedFile: updatePublishedFileService
} = require('../../../services/articles/articlePublishingService');
const ValidationService = require('../../../services/ValidationService');
const staticGen = require('../../../services/domain/staticGen');

// GET /api/v1/articles
async function getAllArticles(req, res) {
    try {
        const articles = await articleService.getAllArticles();
        res.json(articles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// GET /api/v1/articles/:id
async function getArticle(req, res) {
    try {
        const { id } = req.params;
        const article = await articleService.getArticle(id);
        if (!article) return res.status(404).json({ error: 'Article not found' });
        res.json(article);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// PUT /api/v1/articles/:id
async function updateArticle(req, res) {
    try {
        const { id } = req.params;
        const data = req.body;
        const updated = await articleService.updateArticle(id, data);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// DELETE /api/v1/articles/:id
async function deleteArticle(req, res) {
    try {
        const { id } = req.params;
        const deleted = await articleService.deleteArticle(id);
        res.json(deleted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// POST /api/v1/articles/:id/select-version
async function setSelectedVersion(req, res) {
    try {
        const { id } = req.params;
        const { versionId } = req.body;
        if (!versionId) return res.status(400).json({ error: 'Missing versionId' });
        const updated = await articleService.setSelectedVersion(id, versionId);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// POST /api/v1/articles/:id/publish
async function publishBlog(req, res) {
    try {
        const { id } = req.params;
        const result = await publishArticle(id);
        res.json(result);
    } catch (err) {
        let errorMessage = 'Failed to publish blog';
        let statusCode = err.status || 500;

        if (err.message.includes('article not found')) {
            errorMessage = `Article with ID '${req.params.id}' not found`;
            statusCode = 404;
        } else if (err.message.includes('no selected version')) {
            errorMessage = `Article '${req.params.id}' has no selected version`;
            statusCode = 400;
        } else if (err.message.includes('domain not found')) {
            errorMessage = `Domain folder not found for article '${req.params.id}'`;
            statusCode = 404;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied writing blog file.';
            statusCode = 403;
        } else if (err.message.includes('disk space')) {
            errorMessage = 'Insufficient disk space to create blog file.';
            statusCode = 507;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Database or file system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// POST /api/v1/articles/:id/versions/from-editor
async function createVersionFromEditorHandler(req, res) {
    try {
        const { id } = req.params;
        const { content_md, model = 'gemini-2.5-flash', provider = 'gemini' } = req.body;
        if (!content_md) return res.status(400).json({ error: 'Missing content_md' });
        const result = await createVersionFromEditor(id, content_md, { model, provider });
        res.json({
            articleId: id,
            draft: {
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                qcResult: result.qcResult
            },
            status: result.status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// PATCH /api/v1/articles/:id/publish
async function updatePublishedFile(req, res) {
    try {
        const { id } = req.params;
        const { domainName } = req.body;
        const result = await updatePublishedFileService(id, domainName);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

// PUT /api/v1/articles/:id/edit-content
// PUT /api/v1/articles/:id/edit-content
async function editArticleContent(req, res) {
    try {
        const { id } = req.params;
        const {
            content_md,
            model = 'gemini-2.5-flash',
            provider = 'gemini',
            useAI = false  // Default to direct editing without AI
        } = req.body;

        const result = await editArticleContentService(id, content_md, { model, provider, useAI });
        res.json(result);

    } catch (err) {
        let errorMessage = 'Failed to edit article content';
        let statusCode = err.status || 500;

        if (err.message.includes('not found')) {
            errorMessage = err.message;
            statusCode = 404;
        } else if (err.message.includes('Missing')) {
            errorMessage = err.message;
            statusCode = 400;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// PUT /api/v1/articles/:id/edit-content-direct
async function editArticleContentDirect(req, res) {
    // Force direct editing (no AI processing)
    req.body.useAI = false;
    return editArticleContent(req, res);
}

// POST /api/v1/articles/integrateBacklink
async function integrateBacklink(req, res) {
    try {
        const { articleId, backlinkUrl, anchorText, model, provider } = req.body;

        // Input validation
        const validationService = new ValidationService();
        const requiredValidation = validationService.validateRequired(req.body, ['articleId', 'backlinkUrl', 'anchorText']);
        if (!requiredValidation.isValid) {
            return res.status(400).json({
                error: requiredValidation.message,
                code: 'MISSING_REQUIRED_FIELDS'
            });
        }

        // Validate URL format
        if (!validationService.validateUrl(backlinkUrl)) {
            return res.status(400).json({
                error: 'Invalid backlink URL format',
                code: 'INVALID_URL_FORMAT'
            });
        }

        // Validate anchor text
        const anchorValidation = validationService.validateAnchorText(anchorText);
        if (!anchorValidation.isValid) {
            return res.status(400).json({
                error: anchorValidation.message,
                code: anchorValidation.message.includes('empty') ? 'EMPTY_ANCHOR_TEXT' : 'ANCHOR_TEXT_TOO_LONG'
            });
        }

        // Initialize BacklinkService
        const BacklinkService = require('../../../services/BacklinkService');
        const backlinkService = new BacklinkService();

        // Integrate backlink
        const result = await backlinkService.integrateBacklink(
            articleId,
            backlinkUrl,
            anchorText.trim(),
            { model, provider }
        );

        res.json({
            success: true,
            message: 'Backlink integrated successfully',
            newVersionId: result.versionId,
            versionNum: result.versionNum,
            previewContent: result.previewContent,
            backlinkUrl,
            anchorText: anchorText.trim(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        let errorMessage = 'Failed to integrate backlink';
        let statusCode = 500;
        let errorCode = 'INTEGRATION_FAILED';

        if (error.message.includes('Article not found')) {
            errorMessage = 'Article not found';
            statusCode = 404;
            errorCode = 'ARTICLE_NOT_FOUND';
        } else if (error.message.includes('no content versions')) {
            errorMessage = 'Article has no content to modify';
            statusCode = 400;
            errorCode = 'NO_CONTENT_VERSIONS';
        } else if (error.message.includes('Selected version not found')) {
            errorMessage = 'Selected article version not found';
            statusCode = 404;
            errorCode = 'VERSION_NOT_FOUND';
        } else if (error.message.includes('Failed to generate content')) {
            errorMessage = 'AI service failed to generate content with backlink';
            statusCode = 500;
            errorCode = 'AI_GENERATION_FAILED';
        } else if (error.message.includes('Failed to create new article version')) {
            errorMessage = 'Failed to save new article version';
            statusCode = 500;
            errorCode = 'VERSION_CREATION_FAILED';
        } else {
            errorMessage = error.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            code: errorCode,
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/v1/articles/backlinkReviewQueue
async function getBacklinkReviewQueue(req, res) {
    try {
        const { status = 'PENDING_REVIEW', sortBy = 'created_at', sortOrder = 'desc' } = req.query;

        const articles = await articleService.getBacklinkReviewQueue(status, sortBy, sortOrder);
        res.json(articles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// POST /api/v1/articles/approveBacklink/:versionId
async function approveBacklink(req, res) {
    try {
        const { versionId } = req.params;
        const { reviewNotes } = req.body;
        const adminId = req.admin.id;

        const result = await articleService.approveBacklink(versionId, adminId, reviewNotes);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// POST /api/v1/articles/rejectBacklink/:versionId
async function rejectBacklink(req, res) {
    try {
        const { versionId } = req.params;
        const { reviewNotes } = req.body;
        const adminId = req.admin.id;

        const result = await articleService.rejectBacklink(versionId, adminId, reviewNotes);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// POST /api/v1/articles/approveAndPublish/:versionId
async function approveAndPublish(req, res) {
    try {
        const { versionId } = req.params;
        const { reviewNotes } = req.body;
        const adminId = req.admin.id;

        const result = await articleService.approveAndPublish(versionId, adminId, reviewNotes);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// GET /api/v1/articles/browse - Public endpoint for homepage article browsing
async function browseArticles(req, res) {
    try {
        const articles = await articleService.getBrowseArticles();

        // Generate previews for all articles
        const articlesWithPreviews = articles.map(article =>
            articleService.generateArticlePreview(article)
        );

        res.json({
            articles: articlesWithPreviews,
            total: articlesWithPreviews.length,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            error: 'Failed to fetch articles for browsing',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/v1/articles/:id/availability - Check real-time availability
async function checkArticleAvailability(req, res) {
    try {
        const { id } = req.params;
        const availability = await articleService.getArticleAvailability(id);

        res.json({
            articleId: id,
            ...availability,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            error: 'Failed to check article availability',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = {
    getAllArticles,
    getArticle,
    updateArticle,
    deleteArticle,
    setSelectedVersion,
    publishBlog,
    createVersionFromEditorHandler,
    updatePublishedFile,
    editArticleContent,
    editArticleContentDirect,
    integrateBacklink,
    getBacklinkReviewQueue,
    approveBacklink,
    rejectBacklink,
    approveAndPublish,
    browseArticles,
    checkArticleAvailability
}; 