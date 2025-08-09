const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
    prisma = new PrismaClient();
} else {
    // In development, use a global variable to preserve the connection across hot reloads
    if (!global.prisma) {
        global.prisma = new PrismaClient({
            log: ['warn', 'error'], // Only log warnings and errors
        });
    }
    prisma = global.prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

module.exports = prisma; 