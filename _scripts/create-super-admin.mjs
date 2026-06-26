//! This script creates the initial SUPER_ADMIN account
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL?.replace('sslmode=require', '');
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createSuperAdmin() {
  try {
    console.log('=== Dhream Market SUPER_ADMIN Creation ===\n');

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

    const hashedPassword = await bcrypt.hash(password, 12);

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
    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('Failed to create SUPER_ADMIN:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createSuperAdmin();