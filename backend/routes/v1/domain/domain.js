const express = require('express');
const router = express.Router();
const domainController = require('../../../controllers/v1/domain/domain.controller');
const { authenticateAdmin } = require('../../../middleware/auth');

// ===== DOMAIN CRUD OPERATIONS =====

// Create domain
router.post('/createDomain', authenticateAdmin, domainController.createDomain);

// Get domain by id
router.get('/getDomain/:id', authenticateAdmin, domainController.getDomain);

// Get all domains
router.get('/getAllDomains', authenticateAdmin, domainController.getAllDomains);

// Update domain
router.put('/updateDomain/:id', authenticateAdmin, domainController.updateDomain);

// Delete domain
router.delete('/deleteDomain/:id', authenticateAdmin, domainController.deleteDomain);

// ===== DOMAIN TEMPLATE/LAYOUT OPERATIONS =====

// Get available templates/layouts
router.get('/getAvailableTemplates', authenticateAdmin, domainController.getAvailableTemplates);

// Create domain folder (copy template)
router.post('/createDomainFolder', authenticateAdmin, domainController.createDomainFolder);

// Switch domain template/layout
router.put('/switchDomainTemplate', authenticateAdmin, domainController.switchDomainTemplate);

// Get domain layout info
router.get('/getDomainLayout/:domainName', authenticateAdmin, domainController.getDomainLayout);

// List all domain folders
router.get('/listDomains', authenticateAdmin, domainController.listDomains);

// Get domain info (from folder)
router.get('/getDomainInfo/:domainName', authenticateAdmin, domainController.getDomainInfo);

// ===== BLOG OPERATIONS =====

// Add blog post to domain (DEPRECATED - use addArticleToDomain instead)
router.post('/addBlogToDomain', authenticateAdmin, domainController.addBlogToDomain);

// Add article to domain (RECOMMENDED)
router.post('/addArticleToDomain', authenticateAdmin, domainController.addArticleToDomain);

// ===== UTILITY OPERATIONS =====

// Build domain (npm install + build)
router.post('/buildDomain/:domainName', authenticateAdmin, domainController.buildDomain);

// Download built domain as zip
router.get('/downloadDomain/:domainName', authenticateAdmin, domainController.downloadDomain);

// Get build instructions (for manual troubleshooting)
// router.get('/getBuildInstructions/:domainName', domainController.getBuildInstructions);

// Get domain status
router.get('/getDomainStatus/:domainName', authenticateAdmin, domainController.getDomainStatus);

module.exports = router; 