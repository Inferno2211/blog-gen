const AuthService = require('../../../services/AuthService');

const authService = new AuthService();

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password strength validation
 * At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { isValid: false, message: 'Email is required' };
  }
  
  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, message: 'Invalid email format' };
  }
  
  return { isValid: true };
}

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!PASSWORD_REGEX.test(password)) {
    return { 
      isValid: false, 
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
    };
  }
  
  return { isValid: true };
}

/**
 * Admin login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({
        error: emailValidation.message,
        code: 'INVALID_EMAIL',
        timestamp: new Date().toISOString()
      });
    }

    // Attempt login
    const result = await authService.login(email, password);

    res.json({
      success: true,
      token: result.token,
      expiresIn: result.expiresIn,
      admin: result.admin
    });

  } catch (error) {
    console.error('Login error:', error.message);
    
    if (error.message === 'Invalid credentials') {
      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'LOGIN_FAILED',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Admin logout (client-side token invalidation)
 */
async function logout(req, res) {
  try {
    // In JWT-based auth, logout is typically handled client-side by removing the token
    // We could implement a token blacklist here if needed
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error.message);
    
    res.status(500).json({
      error: 'Internal server error',
      code: 'LOGOUT_FAILED',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get all admins
 */
async function getAllAdmins(req, res) {
  try {
    const admins = await authService.getAllAdmins();
    
    res.json({
      success: true,
      admins
    });

  } catch (error) {
    console.error('Get admins error:', error.message);
    
    res.status(500).json({
      error: 'Failed to retrieve admins',
      code: 'GET_ADMINS_FAILED',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Create new admin
 */
async function createAdmin(req, res) {
  try {
    const { email, password, name } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required',
        code: 'MISSING_REQUIRED_FIELDS',
        timestamp: new Date().toISOString()
      });
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json({
        error: emailValidation.message,
        code: 'INVALID_EMAIL',
        timestamp: new Date().toISOString()
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: passwordValidation.message,
        code: 'WEAK_PASSWORD',
        timestamp: new Date().toISOString()
      });
    }

    // Create admin
    const admin = await authService.createAdmin({ email, password, name });

    res.status(201).json({
      success: true,
      admin,
      message: 'Admin created successfully'
    });

  } catch (error) {
    console.error('Create admin error:', error.message);
    
    if (error.message === 'Admin with this email already exists') {
      return res.status(409).json({
        error: 'Admin with this email already exists',
        code: 'EMAIL_ALREADY_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to create admin',
      code: 'CREATE_ADMIN_FAILED',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Update admin
 */
async function updateAdmin(req, res) {
  try {
    const { id } = req.params;
    const { email, password, name } = req.body;

    // Validate admin ID
    if (!id) {
      return res.status(400).json({
        error: 'Admin ID is required',
        code: 'MISSING_ADMIN_ID',
        timestamp: new Date().toISOString()
      });
    }

    // Validate email if provided
    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json({
          error: emailValidation.message,
          code: 'INVALID_EMAIL',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validate password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: passwordValidation.message,
          code: 'WEAK_PASSWORD',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Update admin
    const admin = await authService.updateAdmin(id, { email, password, name });

    res.json({
      success: true,
      admin,
      message: 'Admin updated successfully'
    });

  } catch (error) {
    console.error('Update admin error:', error.message);
    
    if (error.message === 'Admin not found') {
      return res.status(404).json({
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    if (error.message === 'Email already taken by another admin') {
      return res.status(409).json({
        error: 'Email already taken by another admin',
        code: 'EMAIL_ALREADY_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to update admin',
      code: 'UPDATE_ADMIN_FAILED',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Delete admin
 */
async function deleteAdmin(req, res) {
  try {
    const { id } = req.params;

    // Validate admin ID
    if (!id) {
      return res.status(400).json({
        error: 'Admin ID is required',
        code: 'MISSING_ADMIN_ID',
        timestamp: new Date().toISOString()
      });
    }

    // Prevent self-deletion
    if (id === req.adminId) {
      return res.status(400).json({
        error: 'Cannot delete your own admin account',
        code: 'CANNOT_DELETE_SELF',
        timestamp: new Date().toISOString()
      });
    }

    // Delete admin
    await authService.deleteAdmin(id);

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin error:', error.message);
    
    if (error.message === 'Admin not found') {
      return res.status(404).json({
        error: 'Admin not found',
        code: 'ADMIN_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to delete admin',
      code: 'DELETE_ADMIN_FAILED',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  login,
  logout,
  getAllAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  validateEmail,
  validatePassword
};