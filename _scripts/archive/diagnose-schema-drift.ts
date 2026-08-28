import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function diagnoseSchemaDrift() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // ============================================================
    // 1. support_messages — senderType + any enum-typed columns
    // ============================================================
    console.log('=== support_messages COLUMNS (information_schema) ===')
    const smCols = await pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'support_messages'
       ORDER BY ordinal_position`
    )
    console.table(smCols.rows)

    // senderType specifically
    const smSenderType = await pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'support_messages' AND column_name = 'senderType'`
    )
    console.log('\n=== support_messages.senderType (detail) ===')
    console.table(smSenderType.rows)

    // ============================================================
    // 2. support_tickets — enum-typed columns (type, status, priority)
    // ============================================================
    console.log('\n=== support_tickets COLUMNS (information_schema) ===')
    const stCols = await pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'support_tickets'
       ORDER BY ordinal_position`
    )
    console.table(stCols.rows)

    // ============================================================
    // 3. support_conversations — check status & customerType (declared as String in prisma, not enum)
    // ============================================================
    console.log('\n=== support_conversations COLUMNS (information_schema) ===')
    const scCols = await pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'support_conversations'
       ORDER BY ordinal_position`
    )
    console.table(scCols.rows)

    // ============================================================
    // 4. orders — idempotencyKey existence
    // ============================================================
    console.log('\n=== orders COLUMNS (information_schema) ===')
    const orderCols = await pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'orders'
       ORDER BY ordinal_position`
    )
    console.table(orderCols.rows)

    const idempotencyKey = await pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = 'orders' AND column_name = 'idempotencyKey'`
    )
    console.log('\n=== orders.idempotencyKey (detail) ===')
    console.table(idempotencyKey.rows)

    // Check if idempotencyKey index exists
    const idemIdx = await pool.query(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE tablename = 'orders' AND indexname = 'idx_orders_idempotencyKey'`
    )
    console.log('\n=== orders idempotencyKey index ===')
    console.table(idemIdx.rows)

    // ============================================================
    // 5. Check whether the SupportMessageSenderType enum TYPE exists
    // ============================================================
    console.log('\n=== pg_type — enum types containing "Support" ===')
    const enumTypes = await pool.query(
      `SELECT typname, typinput
       FROM pg_type
       WHERE typname ILIKE '%Support%' AND typtype = 'e'`
    )
    console.table(enumTypes.rows)

    // If the enum type exists, show its values
    if (enumTypes.rows.length > 0) {
      for (const row of enumTypes.rows) {
        const vals = await pool.query(
          `SELECT enumlabel, enumsortorder
           FROM pg_enum
           WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = $1)
           ORDER BY enumsortorder`,
          [row.typname]
        )
        console.log(`\n--- enum values for ${row.typname} ---`)
        console.table(vals.rows)
      }
    }

    // ============================================================
    // 6. Cross-check: what the live data looks like for senderType
    // ============================================================
    console.log('\n=== support_messages.senderType value distribution (live) ===')
    const senderDist = await pool.query(
      `SELECT "senderType", COUNT(*) as count
       FROM "support_messages"
       GROUP BY "senderType"
       ORDER BY count DESC`
    )
    console.table(senderDist.rows)
  } catch (error) {
    console.error('Error running diagnostics:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

diagnoseSchemaDrift()
