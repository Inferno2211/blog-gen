const { Prisma } = require('@prisma/client');

function errorHandler(err, req, res, next) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Unique constraint violation
        if (err.code === 'P2002') {
            return res.status(409).json({ error: `Unique constraint failed on field(s): ${err.meta.target.join(', ')}` });
        }
        // Other known Prisma errors
        return res.status(400).json({ error: err.message, code: err.code });
    }
    // Validation or other errors
    if (err.status && err.message) {
        return res.status(err.status).json({ error: err.message });
    }
    // Fallback
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
}

module.exports = { errorHandler }; 