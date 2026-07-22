import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const pool = new Pool({ 
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    maxUses: 7500,
    ssl: { rejectUnauthorized: false },
  })

  console.log('Verifying existing unverified users...')
  const client = await pool.connect()
  try {
    const result = await client.query(`
      UPDATE "users"
      SET
        "isEmailVerified" = true,
        "emailVerifiedAt" = NOW()
      WHERE
        "isEmailVerified" = false
    `)
    console.log(`Successfully updated ${result.rowCount} user(s) to verified status.`)
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
