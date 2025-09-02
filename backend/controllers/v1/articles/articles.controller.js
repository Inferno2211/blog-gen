const { addBlogToDomain, updateBlogInDomain, createVersionFromEditor, createVersionFromEditorDirect } = require('../../../services/articles/coreServices');
const articleService = require('../../../services/articles/dbCrud');
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

        // 1. Get article and domain
        const article = await articleService.getArticle(id);
        if (!article) {
            return res.status(404).json({
                error: 'Article not found',
                details: `No article found with ID: ${id}`
            });
        }

        if (!article.domain) {
            return res.status(400).json({
                error: 'Article has no domain',
                details: 'Please assign a domain to this article before publishing'
            });
        }

        // 2. Check if article has selected version
        if (!article.selected_version_id) {
            return res.status(400).json({
                error: 'No selected version for this article',
                details: 'Please select a version before publishing'
            });
        }

        // 3. Check domain folder exists
        const domainSlug = article.domain.slug;
        const domainFolder = staticGen.DOMAINS_BASE + '/' + domainSlug;
        const fs = require('fs-extra');

        if (!await fs.pathExists(domainFolder)) {
            return res.status(400).json({
                error: 'Domain folder does not exist',
                details: `Domain folder '${domainSlug}' not found`,
                suggestion: 'Please create the domain folder first'
            });
        }

        // 4. Use addArticleToDomain for proper formatting
        const result = await addBlogToDomain(id, domainSlug);

        if (!result.success) {
            return res.status(400).json({
                error: 'Failed to publish blog',
                details: result.message || 'Unknown error occurred'
            });
        }

        // 5. Set status to published
        await articleService.updateArticle(id, { status: 'PUBLISHED' });

        res.json({
            success: true,
            message: 'Blog published successfully!',
            articleId: id,
            file: result.fileName,
            filePath: result.filePath,
            sanitizedSlug: result.sanitizedSlug,
            originalSlug: result.originalSlug,
            article: result.article
        });

    } catch (err) {
        let errorMessage = 'Failed to publish blog';
        let statusCode = 500;

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
        if (!domainName) return res.status(400).json({ error: 'Missing domainName' });
        const result = await updateBlogInDomain(id, domainName);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

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

        if (!content_md) {
            return res.status(400).json({ error: 'Missing content_md' });
        }

        // Get the current article to check status
        const article = await articleService.getArticle(id);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }

        // Choose editing method based on useAI flag
        const result = useAI
            ? await createVersionFromEditor(id, content_md, { model, provider })
            : await createVersionFromEditorDirect(id, content_md);

        // If the article is published, also update the file
        if (article.status === 'PUBLISHED' && article.domain && article.domain.slug) {
            // Set this version as selected first
            await articleService.setSelectedVersion(id, result.versionId);

            // Update the published file
            const updateResult = await updateBlogInDomain(id, article.domain.slug);

            return res.json({
                success: true,
                message: `Article content updated ${useAI ? 'with AI processing' : 'directly'} and published file synchronized`,
                articleId: id,
                versionId: result.versionId,
                versionNum: result.versionNum,
                content: result.content,
                qcResult: result.qcResult,
                status: result.status,
                fileUpdated: true,
                filePath: updateResult.filePath,
                fileName: updateResult.fileName,
                editMethod: useAI ? 'AI_PROCESSED' : 'DIRECT_EDIT'
            });
        }

        // For unpublished articles, just create the version
        res.json({
            success: true,
            message: `Article content updated ${useAI ? 'with AI processing' : 'directly'} in database`,
            articleId: id,
            versionId: result.versionId,
            versionNum: result.versionNum,
            content: result.content,
            qcResult: result.qcResult,
            status: result.status,
            fileUpdated: false,
            editMethod: useAI ? 'AI_PROCESSED' : 'DIRECT_EDIT'
        });

    } catch (err) {
        let errorMessage = 'Failed to edit article content';
        let statusCode = 500;

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
        if (!articleId) {
            return res.status(400).json({
                error: 'Missing required field: articleId',
                code: 'MISSING_ARTICLE_ID'
            });
        }

        if (!backlinkUrl) {
            return res.status(400).json({
                error: 'Missing required field: backlinkUrl',
                code: 'MISSING_BACKLINK_URL'
            });
        }

        if (!anchorText) {
            return res.status(400).json({
                error: 'Missing required field: anchorText',
                code: 'MISSING_ANCHOR_TEXT'
            });
        }

        // Validate URL format
        try {
            new URL(backlinkUrl);
        } catch {
            return res.status(400).json({
                error: 'Invalid backlink URL format',
                code: 'INVALID_URL_FORMAT'
            });
        }

        // Validate anchor text length
        if (anchorText.trim().length === 0) {
            return res.status(400).json({
                error: 'Anchor text cannot be empty',
                code: 'EMPTY_ANCHOR_TEXT'
            });
        }

        if (anchorText.length > 200) {
            return res.status(400).json({
                error: 'Anchor text too long (maximum 200 characters)',
                code: 'ANCHOR_TEXT_TOO_LONG'
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
    approveAndPublish
}; 