const { mockData } = require('../../../data/mockData');
const { createArticleWithVersion, createVersionForArticle } = require('../../../services/articles/coreServices');
const { getArticle } = require('../../../services/articles/dbCrud');
const slugify = require('slugify');

// POST /api/v1/ai/generateArticle
async function generateArticle(req, res) {
    try {
        // Accept a flat body, not meta/genParams objects
        const {
            domain_id, status, user, // meta fields
            niche, keyword, topic, n, targetURL, anchorText, model, provider, // genParams fields
            maxRetries = 3,
            userPrompt,
            internalLinkEnabled = false,
            noExternalBacklinks = true
        } = req.body;
        // Validate required fields
        if (!userPrompt && (!niche && !keyword && !topic && !n && !targetURL && !anchorText)) {
            return res.status(400).json({ error: 'Missing required fields: userPrompt, niche, keyword, topic, n, targetURL, anchorText' });
        }
        //return res.status(200).json(mockData);
        const slug = slugify(topic || '');

        const meta = { domain_id, slug, status, user };
        const genParams = {
            niche, keyword, topic, n, targetURL, anchorText, model, provider, userPrompt,
            isCustomPrompt: !!userPrompt,
            internalLinkEnabled: !!internalLinkEnabled,
            noExternalBacklinks: !!noExternalBacklinks
        };
        const temp = await createArticleWithVersion(meta, genParams, maxRetries);
        const result = {
            articleId: temp.articleId,
            draft: {
                versionId: temp.versionId,
                versionNum: temp.versionNum,
                content: temp.content,
                qcResult: temp.qcResult
            },
            status: temp.status
        };
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// POST /api/v1/ai/generateArticleVersion
async function generateArticleVersion(req, res) {
    try {
        const { articleId, provider = 'gemini', maxRetries = 3, userPrompt, internalLinkEnabled = false, noExternalBacklinks = true } = req.body;
        if (!articleId) {
            return res.status(400).json({ error: 'Missing required fields: articleId' });
        }
        const article = await getArticle(articleId);
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        const genParams = {
            niche: article.niche,
            keyword: article.keyword,
            topic: article.topic,
            n: 3, // or article.n if present
            targetURL: article.backlink_target,
            anchorText: article.anchor,
            provider: provider,
            userPrompt,
            isCustomPrompt: !!userPrompt,
            internalLinkEnabled: !!internalLinkEnabled,
            noExternalBacklinks: !!noExternalBacklinks
        };
        const result = await createVersionForArticle(articleId, genParams, maxRetries);
        res.json({
            articleId,
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

module.exports = {
    generateArticle,
    generateArticleVersion
};
