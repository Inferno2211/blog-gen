const express = require('express');
const { generateArticle, generateArticleVersion } = require('../../../controllers/v1/ai/ai.controller');
const router = express.Router();

// POST /api/v1/ai/generateArticle
router.post('/generateArticle', generateArticle);

// POST /api/v1/ai/generateArticleVersion
router.post('/generateArticleVersion', generateArticleVersion);

module.exports = router;
