const { addBlogToDomain, updateBlogInDomain, createVersionFromEditor, createVersionFromEditorDirect } = require('./coreServices');
const articleService = require('./dbCrud');
const staticGen = require('../domain/staticGen');
const fs = require('fs-extra');

/**
 * Publish an article to its domain
 * @param {string} articleId - The article ID to publish
 * @returns {Object} - Publishing result
 */
async function publishArticle(articleId) {
    // 1. Get article and domain
    const article = await articleService.getArticle(articleId);
    if (!article) {
        const error = new Error('Article not found');
        error.status = 404;
        error.details = `No article found with ID: ${articleId}`;
        throw error;
    }

    if (!article.domain) {
        const error = new Error('Article has no domain');
        error.status = 400;
        error.details = 'Please assign a domain to this article before publishing';
        throw error;
    }

    // 2. Check if article has selected version
    if (!article.selected_version_id) {
        const error = new Error('No selected version for this article');
        error.status = 400;
        error.details = 'Please select a version before publishing';
        throw error;
    }

    // 3. Check domain folder exists
    const domainSlug = article.domain.slug;
    const domainFolder = staticGen.DOMAINS_BASE + '/' + domainSlug;

    if (!await fs.pathExists(domainFolder)) {
        const error = new Error('Domain folder does not exist');
        error.status = 400;
        error.details = `Domain folder '${domainSlug}' not found`;
        error.suggestion = 'Please create the domain folder first';
        throw error;
    }

    // 4. Use addArticleToDomain for proper formatting
    const result = await addBlogToDomain(articleId, domainSlug);

    if (!result.success) {
        const error = new Error('Failed to publish blog');
        error.status = 400;
        error.details = result.message || 'Unknown error occurred';
        throw error;
    }

    // 5. Set status to published
    await articleService.updateArticle(articleId, { status: 'PUBLISHED' });

    return {
        success: true,
        message: 'Blog published successfully!',
        articleId,
        file: result.fileName,
        filePath: result.filePath,
        sanitizedSlug: result.sanitizedSlug,
        originalSlug: result.originalSlug,
        article: result.article
    };
}

/**
 * Edit article content with optional AI processing
 * @param {string} articleId - The article ID
 * @param {string} contentMd - The markdown content
 * @param {Object} options - Options for editing
 * @returns {Object} - Editing result
 */
async function editArticleContent(articleId, contentMd, options = {}) {
    const { model = 'gemini-2.5-flash', provider = 'gemini', useAI = false } = options;

    if (!contentMd) {
        const error = new Error('Missing content_md');
        error.status = 400;
        throw error;
    }

    // Get the current article to check status
    const article = await articleService.getArticle(articleId);
    if (!article) {
        const error = new Error('Article not found');
        error.status = 404;
        throw error;
    }

    // Choose editing method based on useAI flag
    const result = useAI
        ? await createVersionFromEditor(articleId, contentMd, { model, provider })
        : await createVersionFromEditorDirect(articleId, contentMd);

    // If the article is published, also update the file
    if (article.status === 'PUBLISHED' && article.domain && article.domain.slug) {
        // Set this version as selected first
        await articleService.setSelectedVersion(articleId, result.versionId);

        // Update the published file
        const updateResult = await updateBlogInDomain(articleId, article.domain.slug);

        return {
            success: true,
            message: `Article content updated ${useAI ? 'with AI processing' : 'directly'} and published file synchronized`,
            articleId,
            versionId: result.versionId,
            versionNum: result.versionNum,
            content: result.content,
            qcResult: result.qcResult,
            status: result.status,
            fileUpdated: true,
            filePath: updateResult.filePath,
            fileName: updateResult.fileName,
            article: updateResult.article,
            editMethod: useAI ? 'AI_PROCESSED' : 'DIRECT_EDIT'
        };
    }

    // For unpublished articles, just create the version
    return {
        success: true,
        message: `Article content updated ${useAI ? 'with AI processing' : 'directly'} in database`,
        articleId,
        versionId: result.versionId,
        versionNum: result.versionNum,
        content: result.content,
        qcResult: result.qcResult,
        status: result.status,
        fileUpdated: false,
        editMethod: useAI ? 'AI_PROCESSED' : 'DIRECT_EDIT'
    };
}

/**
 * Update published file for an article
 * @param {string} articleId - The article ID
 * @param {string} domainName - The domain name
 * @returns {Object} - Update result
 */
async function updatePublishedFile(articleId, domainName) {
    if (!domainName) {
        const error = new Error('Missing domainName');
        error.status = 400;
        throw error;
    }

    const result = await updateBlogInDomain(articleId, domainName);
    return { success: true, ...result };
}

module.exports = {
    publishArticle,
    editArticleContent,
    updatePublishedFile
};
