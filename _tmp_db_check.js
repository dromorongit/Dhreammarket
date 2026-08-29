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
    const result = await prisma.$queryRaw`SELECT 1 as ok, now() as ts`
    console.log('DB OK:', JSON.stringify(result))
  } catch (e) {
    console.log('DB ERROR:', e.message)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
