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
    editArticleContentDirect
}; 