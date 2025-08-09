const express = require('express');
const router = express.Router();
const domainController = require('../../../controllers/v1/domain/domain.controller');

// ===== DOMAIN CRUD OPERATIONS =====

// Create domain
router.post('/createDomain', domainController.createDomain);

// Get domain by id
router.get('/getDomain/:id', domainController.getDomain);

// Get all domains
router.get('/getAllDomains', domainController.getAllDomains);

// Update domain
router.put('/updateDomain/:id', domainController.updateDomain);

// Delete domain
router.delete('/deleteDomain/:id', domainController.deleteDomain);

// ===== DOMAIN TEMPLATE/LAYOUT OPERATIONS =====

// Get available templates/layouts
router.get('/getAvailableTemplates', domainController.getAvailableTemplates);

// Create domain folder (copy template)
router.post('/createDomainFolder', domainController.createDomainFolder);

// Switch domain template/layout
router.put('/switchDomainTemplate', domainController.switchDomainTemplate);

// Get domain layout info
router.get('/getDomainLayout/:domainName', domainController.getDomainLayout);

// List all domain folders
router.get('/listDomains', domainController.listDomains);

// Get domain info (from folder)
router.get('/getDomainInfo/:domainName', domainController.getDomainInfo);

// ===== BLOG OPERATIONS =====

// Add blog post to domain (DEPRECATED - use addArticleToDomain instead)
router.post('/addBlogToDomain', domainController.addBlogToDomain);

// Add article to domain (RECOMMENDED)
router.post('/addArticleToDomain', domainController.addArticleToDomain);

// ===== UTILITY OPERATIONS =====

// Build domain (npm install + build)
router.post('/buildDomain/:domainName', domainController.buildDomain);

// Download built domain as zip
router.get('/downloadDomain/:domainName', domainController.downloadDomain);

// Get build instructions (for manual troubleshooting)
// router.get('/getBuildInstructions/:domainName', domainController.getBuildInstructions);

// Get domain status
router.get('/getDomainStatus/:domainName', domainController.getDomainStatus);

module.exports = router; 