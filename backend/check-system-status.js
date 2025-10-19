/**
 * System Status Checker
 * Checks Redis, Database, and Queue status before starting the application
 */

const QueueService = require('./services/queue/QueueService');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const queueService = new QueueService();

async function checkSystemStatus() {
    console.log('╔═══════════════════════════════════════════════════════════════');
    console.log('║ 🔍 SYSTEM STATUS CHECK');
    console.log('╚═══════════════════════════════════════════════════════════════\n');

    let allHealthy = true;

    // Check Redis
    console.log('1️⃣  Checking Redis connection...');
    try {
        const redisHealth = await queueService.checkRedisHealth();
        
        if (redisHealth.connected) {
            console.log('   ✅ Redis: HEALTHY');
            console.log(`      Host: ${redisHealth.host}:${redisHealth.port}`);
            console.log(`      Version: ${redisHealth.version}`);
            console.log(`      Memory: ${redisHealth.memoryUsage}\n`);
        } else {
            console.error('   ❌ Redis: FAILED');
            console.error(`      Error: ${redisHealth.error}\n`);
            allHealthy = false;
        }
    } catch (error) {
        console.error('   ❌ Redis: ERROR');
        console.error(`      ${error.message}\n`);
        allHealthy = false;
    }

    // Check Database
    console.log('2️⃣  Checking database connection...');
    try {
        await prisma.$queryRaw`SELECT 1`;
        const articleCount = await prisma.article.count();
        const orderCount = await prisma.order.count();
        
        console.log('   ✅ Database: HEALTHY');
        console.log(`      Articles: ${articleCount}`);
        console.log(`      Orders: ${orderCount}\n`);
    } catch (error) {
        console.error('   ❌ Database: FAILED');
        console.error(`      Error: ${error.message}\n`);
        allHealthy = false;
    }

    // Check Queue Stats
    console.log('3️⃣  Checking queue statistics...');
    try {
        const articleGenStats = await queueService.getQueueStats('article-generation');
        const backlinkStats = await queueService.getQueueStats('backlink-integration');
        
        console.log('   ✅ Queues: ACCESSIBLE');
        console.log('      Article Generation:');
        console.log(`         Waiting: ${articleGenStats.waiting}`);
        console.log(`         Active: ${articleGenStats.active}`);
        console.log(`         Completed: ${articleGenStats.completed}`);
        console.log(`         Failed: ${articleGenStats.failed}`);
        console.log('      Backlink Integration:');
        console.log(`         Waiting: ${backlinkStats.waiting}`);
        console.log(`         Active: ${backlinkStats.active}`);
        console.log(`         Completed: ${backlinkStats.completed}`);
        console.log(`         Failed: ${backlinkStats.failed}\n`);
    } catch (error) {
        console.error('   ❌ Queues: ERROR');
        console.error(`      Error: ${error.message}\n`);
        allHealthy = false;
    }

    // Check Environment Variables
    console.log('4️⃣  Checking environment variables...');
    const requiredVars = [
        'DATABASE_URL',
        'GEMINI_API_KEY',
        'REDIS_HOST',
        'REDIS_PORT',
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'SENDGRID_API_KEY',
        'FROM_EMAIL',
        'FRONTEND_URL'
    ];

    let missingVars = [];
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    }

    if (missingVars.length === 0) {
        console.log('   ✅ Environment: ALL REQUIRED VARIABLES SET\n');
    } else {
        console.error('   ⚠️  Environment: MISSING VARIABLES');
        console.error(`      Missing: ${missingVars.join(', ')}\n`);
        allHealthy = false;
    }

    // Final Status
    console.log('╔═══════════════════════════════════════════════════════════════');
    if (allHealthy) {
        console.log('║ ✅ SYSTEM READY');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log('║ All systems are operational!');
        console.log('║ You can now start:');
        console.log('║   1. npm run dev         (API server)');
        console.log('║   2. npm run worker:dev  (Queue worker)');
    } else {
        console.log('║ ❌ SYSTEM NOT READY');
        console.log('╠═══════════════════════════════════════════════════════════════');
        console.log('║ Please fix the issues above before starting the application');
    }
    console.log('╚═══════════════════════════════════════════════════════════════\n');

    // Cleanup
    await queueService.close();
    await prisma.$disconnect();

    process.exit(allHealthy ? 0 : 1);
}

checkSystemStatus().catch((error) => {
    console.error('Status check failed:', error);
    process.exit(1);
});
