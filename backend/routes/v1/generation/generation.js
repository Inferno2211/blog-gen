const express = require('express');
const router = express.Router();
const generationController = require('../../../controllers/v1/generation/generationController');

/**
 * Article Generation Routes
 * Base path: /api/v1/generation
 */

// Initiate bulk article generation (cart-based)
router.post('/initiate-bulk', generationController.initiateBulkGeneration);

// Get generation cart details
router.get('/cart/:sessionId', generationController.getGenerationCart);

// Verify magic link and create Stripe checkout
router.post('/verify-and-pay', generationController.verifyAndCreateCheckout);

// Get bulk generation status (all orders in session)
router.get('/bulk-status/:sessionId', generationController.getBulkGenerationStatus);

// Stripe webhook for payment completion
// Note: This uses express.raw() middleware, configured in main routes file
router.post('/webhook', generationController.handleGenerationWebhook);

module.exports = router;
