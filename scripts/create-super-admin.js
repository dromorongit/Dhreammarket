#!/usr/bin/env node
/**
 * Secure SUPER_ADMIN creation script (non-interactive)
 * Reads credentials from environment variables for safe, non-interactive execution
 * 
 * Required env vars:
 *   SUPER_ADMIN_EMAIL       - Email address
 *   SUPER_ADMIN_PASSWORD    - Password (min 6 chars)
 *   SUPER_ADMIN_FIRST_NAME  - First name
 *   SUPER_ADMIN_LAST_NAME   - Last name
 * 
 * Optional env vars:
 *   SUPER_ADMIN_BOOTSTRAP_KEY - If set, must be provided via SUPER_ADMIN_BOOTSTRAP_KEY env var to match
 *   ALLOW_SUPER_ADMIN_CREATION - Must be 'true' if NODE_ENV=production
 */

import { getPrisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

// Load environment variables
require('dotenv').config();

async function createSuperAdmin() {
  try {
    console.log('=== Dhream Market SUPER_ADMIN Creation ===\n');
    
    // Environment protection checks
    const nodeEnv = process.env.NODE_ENV || 'development';
    console.log(`Current environment: ${nodeEnv}`);
    
    if (nodeEnv === 'production' && process.env.ALLOW_SUPER_ADMIN_CREATION !== 'true') {
      console.error('❌ SUPER_ADMIN creation is disabled in production environment.');
      console.error('   Set ALLOW_SUPER_ADMIN_CREATION=true to override (emergency use only).');
      process.exit(1);
    }
    
    // Bootstrap key check
    const bootstrapKey = process.env.SUPER_ADMIN_BOOTSTRAP_KEY;
    if (bootstrapKey && process.env.SUPER_ADMIN_BOOTSTRAP_KEY_INPUT !== bootstrapKey) {
      console.error('❌ Invalid bootstrap key. Access denied.');
      process.exit(1);
    }
    
    // Read credentials from environment variables
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const firstName = process.env.SUPER_ADMIN_FIRST_NAME;
    const lastName = process.env.SUPER_ADMIN_LAST_NAME;
    
    if (!email || !password || !firstName || !lastName) {
      console.error('Missing required environment variables.');
      console.error('Required: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD,');
      console.error('          SUPER_ADMIN_FIRST_NAME, SUPER_ADMIN_LAST_NAME');
      process.exit(1);
    }
    
    if (password.length < 6) {
      console.error('❌ Password must be at least 6 characters long.');
      process.exit(1);
    }
    
    // Check if SUPER_ADMIN already exists
    const prisma = getPrisma();
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });
    
    if (existingSuperAdmin) {
      console.error('❌ A SUPER_ADMIN account already exists in the system.');
      console.error('   Only one SUPER_ADMIN can ever exist (enforced by database constraint).');
      console.error('   Email:', existingSuperAdmin.email);
      process.exit(1);
    }
    
    // Normalize email and check for duplicates
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });
    
    if (existingUser) {
      console.error('❌ A user with this email already exists.');
      process.exit(1);
    }
    
    // Hash password and create SUPER_ADMIN
    console.log('🔒 Hashing password...');
    const hashedPassword = await hashPassword(password);
    
    console.log('👤 Creating SUPER_ADMIN account...');
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
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    console.log('\n✅ SUPER_ADMIN created successfully!');
    console.log('   ID:', superAdmin.id);
    console.log('   Email:', superAdmin.email);
    console.log('   Role:', superAdmin.role);
    console.log('   Created At:', superAdmin.createdAt);
    console.log('\n🔐 IMPORTANT:');
    console.log('   - Save these credentials securely');
    console.log('   - This is the ONLY SUPER_ADMIN account that can ever exist');
    console.log('   - Use this account to create ADMIN employees');
    console.log('   - Never share these credentials');
    console.log('   - The database enforces uniqueness of SUPER_ADMIN role');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Failed to create SUPER_ADMIN:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();
