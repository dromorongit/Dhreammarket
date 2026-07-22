import 'dotenv/config'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
})

async function main() {
  const client = await pool.connect()

  try {
    const queries = [
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "darkMode" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'en'`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GHS'`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra'`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN NOT NULL DEFAULT true`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "orderNotifications" BOOLEAN NOT NULL DEFAULT true`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "promotionalNotifications" BOOLEAN NOT NULL DEFAULT false`,
      `ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "systemNotifications" BOOLEAN NOT NULL DEFAULT true`,
    ]

    for (const query of queries) {
      await client.query(query)
      console.log('Executed:', query)
    }

    console.log('All profile settings columns ensured.')
  } finally {
    client.release()
    await pool.end()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
