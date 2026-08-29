require('dotenv').config({ path: '.env' })
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'dromornarh@dhreamarket.com' },
      select: { id: true, email: true, role: true, status: true, isEmailVerified: true, password: true }
    })
    console.log('SUPER_ADMIN_USER:', JSON.stringify(user, null, 2))
  } catch (e) {
    console.log('DB error:', e.message)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
