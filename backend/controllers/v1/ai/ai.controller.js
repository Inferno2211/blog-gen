const { mockData } = require('../../../data/mockData');
const { generateArticle: generateArticleService, generateArticleVersion: generateArticleVersionService } = require('../../../services/llm/aiGenerationService');

// POST /api/v1/ai/generateArticle
async function generateArticle(req, res) {
    try {
        const result = await generateArticleService(req.body);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

// POST /api/v1/ai/generateArticleVersion
async function generateArticleVersion(req, res) {
    try {
        const result = await generateArticleVersionService(req.body);
        res.json(result);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

module.exports = {
    generateArticle,
    generateArticleVersion
};
