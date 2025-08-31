const express = require('express');
const router = express.Router();
const articlesController = require('../../../controllers/v1/articles/articles.controller');
const { authenticateAdmin } = require('../../../middleware/auth');

// CRUD
router.get('/getAllArticles', authenticateAdmin, articlesController.getAllArticles);
router.get('/getArticleById/:id', authenticateAdmin, articlesController.getArticle);
router.put('/updateArticle/:id', authenticateAdmin, articlesController.updateArticle);
router.delete('/deleteArticle/:id', authenticateAdmin, articlesController.deleteArticle);

// Set selected version
router.post('/setSelectedVersion/:id', authenticateAdmin, articlesController.setSelectedVersion);

// Publish blog
router.post('/publishBlog/:id', authenticateAdmin, articlesController.publishBlog);

// Create version from editor content (DB only)
router.post('/createVersionFromEditor/:id', authenticateAdmin, articlesController.createVersionFromEditorHandler);

// Update already published file (Astro overwrite/rename)
router.patch('/publishBlog/:id', authenticateAdmin, articlesController.updatePublishedFile);

// Edit article content - handles both published and unpublished articles
router.put('/editArticleContent/:id', authenticateAdmin, articlesController.editArticleContent);

// Direct edit (no AI processing) - faster for simple edits
router.put('/editArticleContentDirect/:id', authenticateAdmin, articlesController.editArticleContentDirect);

// Backlink integration - regenerate content with integrated backlinks
router.post('/integrateBacklink', authenticateAdmin, articlesController.integrateBacklink);

module.exports = router; 