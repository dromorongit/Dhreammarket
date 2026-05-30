#!/usr/bin/env node
/**
 * Secure SUPER_ADMIN creation script (non-interactive)
 * Reads credentials from environment variables for safe, non-interactive execution
 */

import { getPrisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/auth.js';
import 'dotenv/config';

async function createSuperAdmin() {
  try {
    console.log('=== Dhream Market SUPER_ADMIN Creation ===\n');
    
    const nodeEnv = process.env.NODE_ENV || 'development';
    console.log(Current environment: );
    
    if (nodeEnv === 'production' && process.env.ALLOW_SUPER_ADMIN_CREATION !== 'true') {
      console.error('SUPER_ADMIN creation is disabled in production environment.');
      process.exit(1);
    }
    
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const firstName = process.env.SUPER_ADMIN_FIRST_NAME;
    const lastName = process.env.SUPER_ADMIN_LAST_NAME;
    
    if (!email || !password || !firstName || !lastName) {
      console.error('Missing required environment variables.');
      process.exit(1);
    }
    
    if (password.length < 6) {
      console.error('Password must be at least 6 characters long.');
      process.exit(1);
    }
    
    const prisma = getPrisma();
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });
    
    if (existingSuperAdmin) {
      console.error('A SUPER_ADMIN account already exists in the system.');
      process.exit(1);
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    
    if (existingUser) {
      console.error('A user with this email already exists.');
      process.exit(1);
    }
    
    const hashedPassword = await hashPassword(password);
    
    const superAdmin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        profile: {
          create: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }
        }
      },
      select: { id: true, email: true, role: true, createdAt: true }
    });
    
    console.log('SUPER_ADMIN created successfully!');
    console.log('   ID:', superAdmin.id);
    console.log('   Email:', superAdmin.email);
    process.exit(0);
    
  } catch (error) {
    console.error('Failed to create SUPER_ADMIN:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
