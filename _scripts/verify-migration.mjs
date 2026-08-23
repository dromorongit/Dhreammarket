import 'dotenv/config'
import { Client } from 'pg'

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'support_tickets'
      AND column_name IN (
        'conversationRef', 'guestToken', 'assignedAdminId',
        'lastMessageAt', 'isReadByCustomer', 'isReadByAdmin'
      )
    ORDER BY column_name
  `)
  console.log('Columns found:')
  console.table(result.rows)
} catch (error) {
  console.error('Query failed:', error)
  process.exit(1)
} finally {
  await client.end()
}
