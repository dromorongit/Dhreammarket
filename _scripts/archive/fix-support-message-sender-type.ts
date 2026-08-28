import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function fixSupportMessageSenderType() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('=== Phase 2: Fix support_messages.senderType enum mismatch ===')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Count rows before conversion
      const beforeRes = await client.query('SELECT COUNT(*) AS count FROM "support_messages"')
      const beforeCount = parseInt(beforeRes.rows[0].count, 10)
      console.log(`Rows before: ${beforeCount}`)

      // 2. Ensure the enum type exists (idempotent — matches schema.prisma exactly)
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportMessageSenderType') THEN
            CREATE TYPE "SupportMessageSenderType" AS ENUM ('GUEST', 'CUSTOMER', 'ADMIN', 'SUPER_ADMIN');
          END IF;
        END
        $$;
      `)
      console.log('Enum type SupportMessageSenderType ensured')

      // 3. Convert the column from varchar to enum using a cast
      await client.query(`
        ALTER TABLE "support_messages"
        ALTER COLUMN "senderType" TYPE "SupportMessageSenderType"
        USING "senderType"::"SupportMessageSenderType";
      `)
      console.log('Column senderType converted from varchar to SupportMessageSenderType')

      // 4. Count rows after conversion
      const afterRes = await client.query('SELECT COUNT(*) AS count FROM "support_messages"')
      const afterCount = parseInt(afterRes.rows[0].count, 10)
      console.log(`Rows after:  ${afterCount}`)

      if (beforeCount !== afterCount) {
        throw new Error(
          `Row count mismatch: before=${beforeCount}, after=${afterCount}. Rolling back transaction.`
        )
      }

      // 5. Verify the column type changed
      const verifyRes = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'support_messages' AND column_name = 'senderType'
      `)
      console.table(verifyRes.rows)

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

fixSupportMessageSenderType()
