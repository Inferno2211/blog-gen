const express = require('express');
const { generateArticle, generateArticleVersion } = require('../../../controllers/v1/ai/ai.controller');
const { authenticateAdmin } = require('../../../middleware/auth');
const router = express.Router();

// POST /api/v1/ai/generateArticle
router.post('/generateArticle', authenticateAdmin, generateArticle);

// POST /api/v1/ai/generateArticleVersion
router.post('/generateArticleVersion', authenticateAdmin, generateArticleVersion);

module.exports = router;
