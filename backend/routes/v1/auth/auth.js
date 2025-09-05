const express = require('express');
const router = express.Router();

const adminController = require('../../../controllers/v1/auth/admin.controller');
const { authenticateAdmin } = require('../../../middleware/auth');

/**
 * Authentication Routes (Unprotected)
 */

// POST /api/v1/auth/login - Admin login
router.post('/login', adminController.login);

// POST /api/v1/auth/logout - Admin logout (requires authentication)
router.post('/logout', authenticateAdmin, adminController.logout);

/**
 * Admin Management Routes (Protected)
 */

// GET /api/v1/auth/admins - Get all admins
router.get('/admins', authenticateAdmin, adminController.getAllAdmins);

// POST /api/v1/auth/admins - Create new admin
router.post('/admins', authenticateAdmin, adminController.createAdmin);

// PUT /api/v1/auth/admins/:id - Update admin
router.put('/admins/:id', authenticateAdmin, adminController.updateAdmin);

// DELETE /api/v1/auth/admins/:id - Delete admin
router.delete('/admins/:id', authenticateAdmin, adminController.deleteAdmin);

module.exports = router;