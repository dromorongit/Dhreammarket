const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

async function main() {
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const rows = await prisma.$queryRaw`
    SELECT id, name, slug FROM product_categories 
    WHERE name = 'Fridges and Freezers' 
       OR slug = 'fridges-freezers' 
       OR name LIKE '%Fridge%'
    LIMIT 5
  `
  console.log(JSON.stringify(rows, null, 2))
  await prisma.$disconnect()
  await pool.end()
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
