import 'dotenv/config'
import { readFileSync } from 'fs'
import { Client } from 'pg'

const sql = readFileSync('_scripts/add-missing-support-ticket-columns.sql', 'utf-8')

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log('Connected to database')
  await client.query(sql)
  console.log('Migration executed successfully')
} catch (error) {
  console.error('Migration failed:', error)
  process.exit(1)
} finally {
  await client.end()
}
