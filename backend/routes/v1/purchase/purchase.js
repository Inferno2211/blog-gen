const express = require('express');
const router = express.Router();
const purchaseController = require('../../../controllers/v1/purchase/purchase.controller');

// Purchase workflow endpoints
router.post('/initiate', purchaseController.initiatePurchase);
router.post('/verify-session', purchaseController.verifySession);
router.post('/complete', purchaseController.completePayment);
router.get('/status/:orderId', purchaseController.getOrderStatus);

// Stripe webhook endpoint (requires raw body)
router.post('/webhook', express.raw({ type: 'application/json' }), purchaseController.handleWebhook);

// Payment status endpoint
router.get('/payment-status/:orderId', purchaseController.getPaymentStatus);

module.exports = router;