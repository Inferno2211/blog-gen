const { Prisma } = require('@prisma/client');

function errorHandler(err, req, res, next) {
    // Authentication and Authorization errors
    if (err.name === 'UnauthorizedError' || err.status === 401) {
        return res.status(401).json({
            error: 'Access denied. Authentication required.',
            code: 'UNAUTHORIZED',
            timestamp: new Date().toISOString()
        });
    }

    if (err.name === 'ForbiddenError' || err.status === 403) {
        return res.status(403).json({
            error: 'Access denied. Insufficient permissions.',
            code: 'FORBIDDEN',
            timestamp: new Date().toISOString()
        });
    }

    // JWT specific errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Access denied. Invalid token.',
            code: 'INVALID_TOKEN',
            timestamp: new Date().toISOString()
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Access denied. Token expired.',
            code: 'TOKEN_EXPIRED',
            timestamp: new Date().toISOString()
        });
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint violation
        if (err.code === 'P2002') {
            return res.status(409).json({ 
                error: `Unique constraint failed on field(s): ${err.meta.target.join(', ')}`,
                code: 'UNIQUE_CONSTRAINT_VIOLATION',
                timestamp: new Date().toISOString()
            });
        }
        // Other known Prisma errors
        return res.status(400).json({ 
            error: err.message, 
            code: err.code,
            timestamp: new Date().toISOString()
        });
    }
    
    // Validation or other errors
    if (err.status && err.message) {
        return res.status(err.status).json({ 
            error: err.message,
            code: err.code || 'VALIDATION_ERROR',
            timestamp: new Date().toISOString()
        });
    }
    
    // Fallback
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error', 
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}

module.exports = { errorHandler }; 