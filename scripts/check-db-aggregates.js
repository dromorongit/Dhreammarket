require('dotenv').config()
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL

async function main() {
  console.log('DATABASE_URL set:', !!connectionString)
  console.log('URL prefix:', connectionString ? connectionString.substring(0, 40) : 'N/A')

  const pool = new Pool({
    connectionString,
  })

  const client = await pool.connect()
  try {
    const paidOrdersResult = await client.query('SELECT COUNT(*)::int AS count FROM "orders" WHERE "paymentStatus" = \'PAID\'')
    console.log('Paid orders total:', paidOrdersResult.rows[0].count)

    const multiStoreResult = await client.query(`
      SELECT COUNT(DISTINCT "o"."id")::int AS count
      FROM "orders" "o"
      JOIN "order_items" "oi" ON "oi"."orderId" = "o"."id"
      JOIN "products" "p" ON "p"."id" = "oi"."productId"
      WHERE "o"."paymentStatus" = 'PAID'
      GROUP BY "o"."id"
      HAVING COUNT(DISTINCT "p"."storeId") > 1
    `)
    console.log('Paid orders with items from more than one store:', multiStoreResult.rows[0]?.count ?? 0)
  } catch (e) {
    console.error('Query error:', e.message)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message)
  process.exit(1)
})
