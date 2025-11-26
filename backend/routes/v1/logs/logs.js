const express = require('express');
const router = express.Router();

const logsController = require('../../../controllers/v1/logs/logs.controller');
const { authenticateAdmin } = require('../../../middleware/auth');

/**
 * Logs Routes (Protected)
 */

// GET /api/v1/logs - Get worker logs
router.get('/', authenticateAdmin, logsController.getLogs);

module.exports = router;

