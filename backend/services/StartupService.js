const AuthService = require('./AuthService');
const { PrismaClient } = require('@prisma/client');
const QueueService = require('./queue/QueueService');

const prisma = new PrismaClient();
const authService = new AuthService();
const queueService = new QueueService();

class StartupService {
  constructor() {
    this.defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    this.defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Admin123!@';
    this.defaultAdminName = process.env.ADMIN_NAME || 'System Administrator';
  }

  /**
   * Initialize the system on startup
   */
  async initialize() {
    try {
      console.log('🚀 Initializing system...');
      
      // Check Redis connection first
      await this.checkRedisConnection();
      
      await this.initializeDefaultAdmin();
      
      console.log('✅ System initialization completed successfully');
    } catch (error) {
      console.error('❌ System initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Check Redis connection and display status
   */
  async checkRedisConnection() {
    try {
      console.log('🔍 Checking Redis connection...');
      const redisHealth = await queueService.checkRedisHealth();
      
      if (redisHealth.connected) {
        console.log('✅ Redis Connection: HEALTHY');
        console.log(`   - Host: ${redisHealth.host}:${redisHealth.port}`);
        console.log(`   - Version: ${redisHealth.version}`);
        console.log(`   - Memory Usage: ${redisHealth.memoryUsage}`);
        console.log(`   - Ping: ${redisHealth.ping}`);
      } else {
        console.error('❌ Redis Connection: FAILED');
        console.error(`   - Host: ${redisHealth.host}:${redisHealth.port}`);
        console.error(`   - Error: ${redisHealth.error}`);
        console.error('');
        console.error('⚠️  WARNING: Queue system will not work without Redis!');
        console.error('   Please start Redis server:');
        console.error('   - Windows WSL: wsl sudo redis-server');
        console.error('   - macOS: brew services start redis');
        console.error('   - Linux: sudo systemctl start redis');
        console.error('');
        throw new Error('Redis connection failed - Queue system unavailable');
      }
    } catch (error) {
      console.error('❌ Redis health check failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if any admin users exist in the system
   */
  async checkAdminExists() {
    try {
      const adminCount = await prisma.admin.count();
      return adminCount > 0;
    } catch (error) {
      console.error('Error checking admin existence:', error.message);
      throw error;
    }
  }

  /**
   * Create default admin user from environment variables
   */
  async createDefaultAdmin(credentials = null) {
    try {
      const adminData = credentials || {
        email: this.defaultAdminEmail,
        password: this.defaultAdminPassword,
        name: this.defaultAdminName
      };

      // Validate environment variables
      if (!adminData.email || !adminData.password) {
        throw new Error('Admin email and password must be provided via environment variables or parameters');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminData.email)) {
        console.warn('⚠️  Invalid admin email format in environment variables, using default');
        adminData.email = 'admin@example.com';
      }

      // Validate password strength
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      if (!passwordRegex.test(adminData.password)) {
        console.warn('⚠️  Weak admin password in environment variables, using secure default');
        adminData.password = 'SecureAdmin123!@';
      }

      const admin = await authService.createAdmin(adminData);
      
      console.log(`✅ Default admin created successfully with email: ${admin.email}`);
      
      // Log warning if using default credentials
      if (adminData.email === 'admin@example.com' || adminData.password === 'SecureAdmin123!@') {
        console.warn('⚠️  WARNING: Using default admin credentials. Please change them immediately for security!');
      }

      return admin;
    } catch (error) {
      if (error.message === 'Admin with this email already exists') {
        console.log('ℹ️  Default admin already exists, skipping creation');
        return null;
      }
      
      console.error('Error creating default admin:', error.message);
      throw error;
    }
  }

  /**
   * Initialize default admin user if none exists
   */
  async initializeDefaultAdmin() {
    try {
      const adminExists = await this.checkAdminExists();
      
      if (!adminExists) {
        console.log('📝 No admin users found, creating default admin...');
        
        // Check if environment variables are set
        if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
          console.warn('⚠️  ADMIN_EMAIL and/or ADMIN_PASSWORD not set in environment variables');
          console.warn('⚠️  Using default credentials - CHANGE THESE IMMEDIATELY!');
        }
        
        await this.createDefaultAdmin();
      } else {
        console.log('✅ Admin users already exist, skipping default admin creation');
      }
    } catch (error) {
      console.error('Failed to initialize default admin:', error.message);
      throw error;
    }
  }

  /**
   * Get system status information
   */
  async getSystemStatus() {
    try {
      const adminCount = await prisma.admin.count();
      
      return {
        adminCount,
        hasAdmins: adminCount > 0,
        defaultAdminEmail: this.defaultAdminEmail,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting system status:', error.message);
      throw error;
    }
  }

  /**
   * Reset system (for development/testing purposes)
   * WARNING: This will delete all admin users
   */
  async resetSystem() {
    try {
      console.warn('⚠️  RESETTING SYSTEM - This will delete all admin users!');
      
      // Delete all admins
      await prisma.admin.deleteMany({});
      
      // Recreate default admin
      await this.createDefaultAdmin();
      
      console.log('✅ System reset completed');
    } catch (error) {
      console.error('Error resetting system:', error.message);
      throw error;
    }
  }
}

module.exports = StartupService;