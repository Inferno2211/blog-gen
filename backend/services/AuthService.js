const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecureSecret();
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    
    if (!process.env.JWT_SECRET) {
      console.warn('JWT_SECRET not found in environment variables. Using generated secret.');
    }
  }

  generateSecureSecret() {
    return require('crypto').randomBytes(64).toString('hex');
  }

  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, this.bcryptRounds);
    } catch (error) {
      throw new Error('Password hashing failed');
    }
  }

  async comparePassword(plainPassword, hashedPassword) {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      throw new Error('Password comparison failed');
    }
  }

  generateToken(admin) {
    const payload = {
      adminId: admin.id,
      email: admin.email,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check if admin still exists in database
      const admin = await prisma.admin.findUnique({
        where: { id: decoded.adminId },
        select: { id: true, email: true, name: true }
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      return { ...decoded, admin };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  async login(email, password) {
    try {
      // Find admin by email
      const admin = await prisma.admin.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!admin) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await this.comparePassword(password, admin.password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await prisma.admin.update({
        where: { id: admin.id },
        data: { last_login: new Date() }
      });

      // Generate token
      const token = this.generateToken(admin);

      return {
        token,
        expiresIn: this.jwtExpiresIn,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async createAdmin(adminData) {
    try {
      const { email, password, name } = adminData;

      // Check if admin already exists
      const existingAdmin = await prisma.admin.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingAdmin) {
        throw new Error('Admin with this email already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create admin
      const admin = await prisma.admin.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          name: name || null
        },
        select: {
          id: true,
          email: true,
          name: true,
          created_at: true
        }
      });

      return admin;
    } catch (error) {
      throw error;
    }
  }

  async updateAdmin(id, updateData) {
    try {
      const { email, password, name } = updateData;
      const updateFields = {};

      if (email) {
        // Check if email is already taken by another admin
        const existingAdmin = await prisma.admin.findFirst({
          where: {
            email: email.toLowerCase(),
            NOT: { id }
          }
        });

        if (existingAdmin) {
          throw new Error('Email already taken by another admin');
        }

        updateFields.email = email.toLowerCase();
      }

      if (password) {
        updateFields.password = await this.hashPassword(password);
      }

      if (name !== undefined) {
        updateFields.name = name;
      }

      const admin = await prisma.admin.update({
        where: { id },
        data: updateFields,
        select: {
          id: true,
          email: true,
          name: true,
          updated_at: true
        }
      });

      return admin;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new Error('Admin not found');
      }
      throw error;
    }
  }

  async deleteAdmin(id) {
    try {
      await prisma.admin.delete({
        where: { id }
      });
      return { success: true };
    } catch (error) {
      if (error.code === 'P2025') {
        throw new Error('Admin not found');
      }
      throw error;
    }
  }

  async getAllAdmins() {
    try {
      const admins = await prisma.admin.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          created_at: true,
          last_login: true
        },
        orderBy: { created_at: 'desc' }
      });

      return admins;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuthService;