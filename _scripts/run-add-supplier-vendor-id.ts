import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function addSupplierVendorId() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Adding vendorId column to suppliers table...')

    await pool.query(`
      ALTER TABLE suppliers 
      ADD COLUMN IF NOT EXISTS "vendorId" VARCHAR(255);
    `)
    console.log('Added vendorId column')

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_suppliers_vendorId ON suppliers("vendorId");
    `)
    console.log('Created index idx_suppliers_vendorId')

    console.log('Successfully added supplier vendorId column and index')
  } catch (error) {
    console.error('Error adding supplier vendorId column:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

addSupplierVendorId()
