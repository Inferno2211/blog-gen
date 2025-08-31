const AuthService = require('../services/AuthService');

const authService = new AuthService();

/**
 * Authentication middleware for protecting routes
 * Extracts JWT token from Authorization header and validates it
 */
async function authenticateAdmin(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    // Check if header starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access denied. Invalid token format.',
        code: 'INVALID_TOKEN_FORMAT',
        timestamp: new Date().toISOString()
      });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.',
        code: 'NO_TOKEN',
        timestamp: new Date().toISOString()
      });
    }

    // Verify token
    const decoded = await authService.verifyToken(token);
    
    // Attach admin info to request object
    req.admin = decoded.admin;
    req.adminId = decoded.adminId;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    let errorCode = 'AUTHENTICATION_FAILED';
    let statusCode = 401;
    
    if (error.message === 'Token expired') {
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.message === 'Invalid token') {
      errorCode = 'INVALID_TOKEN';
    } else if (error.message === 'Admin not found') {
      errorCode = 'ADMIN_NOT_FOUND';
    }

    return res.status(statusCode).json({
      error: 'Access denied. Authentication failed.',
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Optional authentication middleware that doesn't fail if no token is provided
 * Useful for routes that have different behavior for authenticated vs unauthenticated users
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded = await authService.verifyToken(token);
        req.admin = decoded.admin;
        req.adminId = decoded.adminId;
      }
    }
    
    next();
  } catch (error) {
    // For optional auth, we don't fail on token errors
    // Just continue without setting admin info
    next();
  }
}

module.exports = {
  authenticateAdmin,
  optionalAuth
};