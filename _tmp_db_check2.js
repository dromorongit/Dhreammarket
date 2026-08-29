require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('DB CONNECT OK');
    const result = await prisma.$queryRaw`SELECT 1 as ok, now() as ts`;
    console.log('DB QUERY OK:', JSON.stringify(result));
  } catch (e) {
    console.log('DB ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
