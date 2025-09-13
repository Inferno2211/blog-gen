const express = require('express');
const router = express.Router();
const purchaseController = require('../../../controllers/v1/purchase/purchase.controller');

// Purchase workflow endpoints
router.post('/initiate', purchaseController.initiatePurchase);
router.post('/verify-session', purchaseController.verifySession);
router.post('/complete', purchaseController.completePayment);
router.get('/status/:orderId', purchaseController.getOrderStatus);

module.exports = router;