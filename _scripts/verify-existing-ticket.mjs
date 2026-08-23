import 'dotenv/config'
import { Client } from 'pg'

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  const result = await client.query(`
    SELECT id, subject, status, "conversationRef", "guestToken", "assignedAdminId", "lastMessageAt", "isReadByCustomer", "isReadByAdmin"
    FROM support_tickets
    WHERE id = 'cmsm8t7tu00001kn0medfgkzk'
  `)
  console.log('Ticket found:')
  console.table(result.rows)
} catch (error) {
  console.error('Query failed:', error)
  process.exit(1)
} finally {
  await client.end()
}
