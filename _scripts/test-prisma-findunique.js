require('dotenv').config({ path: '.env' })
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
  })

  try {
    console.log('Attempting findUnique...')
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: 'cmsm8t7tu00001kn0medfgkzk' },
    })
    console.log('Ticket:', ticket)
  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
