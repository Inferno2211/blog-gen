const AuthService = require('../../../services/AuthService');
const ValidationService = require('../../../services/ValidationService');

const authService = new AuthService();
const validationService = new ValidationService();

// (Copied from original adminController.js)
async function login(req, res) {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({ error: 'Email and password are required', code: 'MISSING_CREDENTIALS', timestamp: new Date().toISOString() });
		}
		const emailValidation = validationService.validateEmail(email);
		if (!emailValidation.isValid) {
			return res.status(400).json({ error: emailValidation.message, code: 'INVALID_EMAIL', timestamp: new Date().toISOString() });
		}
		const result = await authService.login(email, password);
		res.json({ success: true, token: result.token, expiresIn: result.expiresIn, admin: result.admin });
	} catch (error) {
		if (error.message === 'Invalid credentials') {
			return res.status(401).json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS', timestamp: new Date().toISOString() });
		}
		res.status(500).json({ error: 'Internal server error', code: 'LOGIN_FAILED', timestamp: new Date().toISOString() });
	}
}

async function logout(req, res) {
	try {
		res.json({ success: true, message: 'Logged out successfully' });
	} catch (error) {
		res.status(500).json({ error: 'Internal server error', code: 'LOGOUT_FAILED', timestamp: new Date().toISOString() });
	}
}

async function getAllAdmins(req, res) {
	try {
		const admins = await authService.getAllAdmins();
		res.json({ success: true, admins });
	} catch (error) {
		res.status(500).json({ error: 'Failed to retrieve admins', code: 'GET_ADMINS_FAILED', timestamp: new Date().toISOString() });
	}
}

async function createAdmin(req, res) {
	try {
		const { email, password, name } = req.body;
		if (!email || !password) {
			return res.status(400).json({ error: 'Email and password are required', code: 'MISSING_REQUIRED_FIELDS', timestamp: new Date().toISOString() });
		}
		const emailValidation = validationService.validateEmail(email);
		if (!emailValidation.isValid) {
			return res.status(400).json({ error: emailValidation.message, code: 'INVALID_EMAIL', timestamp: new Date().toISOString() });
		}
		const passwordValidation = validationService.validatePassword(password);
		if (!passwordValidation.isValid) {
			return res.status(400).json({ error: passwordValidation.message, code: 'WEAK_PASSWORD', timestamp: new Date().toISOString() });
		}
		const admin = await authService.createAdmin({ email, password, name });
		res.status(201).json({ success: true, admin, message: 'Admin created successfully' });
	} catch (error) {
		if (error.message === 'Admin with this email already exists') {
			return res.status(409).json({ error: 'Admin with this email already exists', code: 'EMAIL_ALREADY_EXISTS', timestamp: new Date().toISOString() });
		}
		res.status(500).json({ error: 'Failed to create admin', code: 'CREATE_ADMIN_FAILED', timestamp: new Date().toISOString() });
	}
}

async function updateAdmin(req, res) {
	try {
		const { id } = req.params;
		const { email, password, name } = req.body;
		if (!id) {
			return res.status(400).json({ error: 'Admin ID is required', code: 'MISSING_ADMIN_ID', timestamp: new Date().toISOString() });
		}
		if (email) {
			const emailValidation = validationService.validateEmail(email);
			if (!emailValidation.isValid) {
				return res.status(400).json({ error: emailValidation.message, code: 'INVALID_EMAIL', timestamp: new Date().toISOString() });
			}
		}
		if (password) {
			const passwordValidation = validationService.validatePassword(password);
			if (!passwordValidation.isValid) {
				return res.status(400).json({ error: passwordValidation.message, code: 'WEAK_PASSWORD', timestamp: new Date().toISOString() });
			}
		}
		const admin = await authService.updateAdmin(id, { email, password, name });
		res.json({ success: true, admin, message: 'Admin updated successfully' });
	} catch (error) {
		if (error.message === 'Admin not found') {
			return res.status(404).json({ error: 'Admin not found', code: 'ADMIN_NOT_FOUND', timestamp: new Date().toISOString() });
		}
		if (error.message === 'Email already taken by another admin') {
			return res.status(409).json({ error: 'Email already taken by another admin', code: 'EMAIL_ALREADY_EXISTS', timestamp: new Date().toISOString() });
		}
		res.status(500).json({ error: 'Failed to update admin', code: 'UPDATE_ADMIN_FAILED', timestamp: new Date().toISOString() });
	}
}

async function deleteAdmin(req, res) {
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({ error: 'Admin ID is required', code: 'MISSING_ADMIN_ID', timestamp: new Date().toISOString() });
		}
		if (id === req.adminId) {
			return res.status(400).json({ error: 'Cannot delete your own admin account', code: 'CANNOT_DELETE_SELF', timestamp: new Date().toISOString() });
		}
		await authService.deleteAdmin(id);
		res.json({ success: true, message: 'Admin deleted successfully' });
	} catch (error) {
		if (error.message === 'Admin not found') {
			return res.status(404).json({ error: 'Admin not found', code: 'ADMIN_NOT_FOUND', timestamp: new Date().toISOString() });
		}
		res.status(500).json({ error: 'Failed to delete admin', code: 'DELETE_ADMIN_FAILED', timestamp: new Date().toISOString() });
	}
}

module.exports = { login, logout, getAllAdmins, createAdmin, updateAdmin, deleteAdmin };
