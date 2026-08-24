import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function fixOrdersIdempotencyKey() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('=== Phase 3: Add missing orders.idempotencyKey column ===')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Count rows before (for sanity check)
      const beforeRes = await client.query('SELECT COUNT(*) AS count FROM "orders"')
      const beforeCount = parseInt(beforeRes.rows[0].count, 10)
      console.log(`Orders rows before: ${beforeCount}`)

      // 2. Check if the column already exists (idempotent)
      const colCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'idempotencyKey'
      `)
      const exists = colCheck.rows.length > 0
      console.log(`Column idempotencyKey already exists: ${exists}`)

      // 3. Add the column if it doesn't exist.
      // schema.prisma declares: idempotencyKey String?  (no @db.VarChar annotation)
      // In this project, unannotated String → TEXT in PostgreSQL (confirmed by live DB:
      // vendorRejectionReason, customerAddress, shippingZone are all text)
      if (!exists) {
        await client.query(`
          ALTER TABLE "orders"
          ADD COLUMN "idempotencyKey" TEXT;
        `)
        console.log('Column idempotencyKey added as TEXT')
      }

      // 4. Create the index (schema.prisma has @@index([idempotencyKey]))
      await client.query(`
        CREATE INDEX IF NOT EXISTS "idx_orders_idempotencyKey" ON "orders"("idempotencyKey");
      `)
      console.log('Index idx_orders_idempotencyKey ensured')

      // 5. Count rows after (should be identical)
      const afterRes = await client.query('SELECT COUNT(*) AS count FROM "orders"')
      const afterCount = parseInt(afterRes.rows[0].count, 10)
      console.log(`Orders rows after:  ${afterCount}`)

      if (beforeCount !== afterCount) {
        throw new Error(
          `Row count mismatch: before=${beforeCount}, after=${afterCount}. Rolling back transaction.`
        )
      }

      // 6. Verify the column exists with correct type
      const verifyRes = await client.query(`
        SELECT column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'idempotencyKey'
      `)
      console.table(verifyRes.rows)

      // 7. Verify the index exists
      const idxRes = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'orders' AND indexname = 'idx_orders_idempotencyKey'
      `)
      console.table(idxRes.rows)

      await client.query('COMMIT')
      console.log('✓ Transaction committed successfully. No data loss.')
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('✗ Transaction rolled back due to error:', error)
      throw error
    } finally {
      await client.release()
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

fixOrdersIdempotencyKey()
