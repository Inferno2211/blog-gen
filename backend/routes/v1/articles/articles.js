const express = require('express');
const router = express.Router();
const articlesController = require('../../../controllers/v1/articles/articles.controller');

// CRUD
router.get('/getAllArticles', articlesController.getAllArticles);
router.get('/getArticleById/:id', articlesController.getArticle);
router.put('/updateArticle/:id', articlesController.updateArticle);
router.delete('/deleteArticle/:id', articlesController.deleteArticle);

// Set selected version
router.post('/setSelectedVersion/:id', articlesController.setSelectedVersion);

// Publish blog
router.post('/publishBlog/:id', articlesController.publishBlog);

// Create version from editor content (DB only)
router.post('/createVersionFromEditor/:id', articlesController.createVersionFromEditorHandler);

// Update already published file (Astro overwrite/rename)
router.patch('/publishBlog/:id', articlesController.updatePublishedFile);

module.exports = router; 