import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const client = await pool.connect()
  try {
    console.log('Adding index: products_storeId_idx...')
    await client.query('CREATE INDEX IF NOT EXISTS "products_storeId_idx" ON "products"("storeId")')
    console.log('Done.')

    console.log('Adding index: products_categoryId_idx...')
    await client.query('CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId")')
    console.log('Done.')

    console.log('Adding index: wishlist_items_wishlistId_idx...')
    await client.query('CREATE INDEX IF NOT EXISTS "wishlist_items_wishlistId_idx" ON "wishlist_items"("wishlistId")')
    console.log('Done.')

    console.log('Adding index: wishlist_items_productId_idx...')
    await client.query('CREATE INDEX IF NOT EXISTS "wishlist_items_productId_idx" ON "wishlist_items"("productId")')
    console.log('Done.')

    console.log('All indexes created successfully.')
  } catch (error) {
    console.error('Error creating indexes:', error)
  } finally {
    client.release()
    await pool.end()
  }
}

main()