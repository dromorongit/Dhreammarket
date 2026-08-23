const { Pool } = require('pg')
require('dotenv').config({ path: '.env' })

async function diagnoseSupport() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // Check all enums in database
    console.log('=== ALL ENUMS IN DATABASE ===')
    const enums = await pool.query(`
      SELECT t.typname AS enum_name,
             string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      GROUP BY t.typname
      ORDER BY t.typname
    `)
    console.table(enums.rows)

    // Check the single existing ticket
    console.log('\n=== EXISTING TICKET ===')
    const ticket = await pool.query(`
      SELECT * FROM "support_tickets" ORDER BY "createdAt" DESC LIMIT 1
    `)
    console.log(JSON.stringify(ticket.rows[0], null, 2))

    // Check conversations count
    console.log('\n=== CONVERSATIONS COUNT ===')
    const convCount = await pool.query('SELECT COUNT(*) FROM "support_conversations"')
    console.log(convCount.rows[0].count)

    // Check messages count
    console.log('\n=== MESSAGES COUNT ===')
    const msgCount = await pool.query('SELECT COUNT(*) FROM "support_messages"')
    console.log(msgCount.rows[0].count)

    // Check if support_tickets has the columns that Prisma schema expects
    console.log('\n=== CHECKING FOR MISSING COLUMNS ON support_tickets ===')
    const expectedColumns = ['conversationRef', 'guestToken', 'assignedAdminId', 'lastMessageAt', 'isReadByCustomer', 'isReadByAdmin']
    for (const col of expectedColumns) {
      const result = await pool.query(`
        SELECT COUNT(*) as exists_count
        FROM information_schema.columns
        WHERE table_name = 'support_tickets' AND column_name = $1
      `, [col])
      const exists = result.rows[0].exists_count > 0
      console.log(`  ${col}: ${exists ? 'EXISTS' : 'MISSING'}`)
    }

  } catch (error) {
    console.error('Error querying database:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

diagnoseSupport()
