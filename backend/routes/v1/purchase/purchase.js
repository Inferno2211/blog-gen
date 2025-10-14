const express = require('express');
const router = express.Router();
const purchaseController = require('../../../controllers/v1/purchase/purchase.controller');

// Purchase workflow endpoints
router.post('/initiate', purchaseController.initiatePurchase);
router.post('/initiate-article', purchaseController.initiateArticlePurchase);
router.post('/verify-session', purchaseController.verifySession);
router.post('/complete', purchaseController.completePayment);
router.get('/status/:orderId', purchaseController.getOrderStatus);

// Customer backlink configuration endpoints
router.get('/order/:orderId', purchaseController.getOrderDetails);
router.post('/configure-backlink', purchaseController.configureBacklink);
router.post('/regenerate-backlink', purchaseController.regenerateBacklink);

// Customer article generation endpoints
router.post('/configure-article', purchaseController.configureArticle);
router.post('/regenerate-article', purchaseController.regenerateArticle);

// Submit for review (works for both backlinks and articles)
router.post('/submit-for-review', purchaseController.submitForReview);

// Stripe webhook endpoint (raw body middleware applied at app level)
router.post('/webhook', purchaseController.handleWebhook);

// Payment status endpoint
router.get('/payment-status/:orderId', purchaseController.getPaymentStatus);

module.exports = router;