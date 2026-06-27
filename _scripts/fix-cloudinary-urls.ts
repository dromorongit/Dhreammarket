import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const images = await prisma.$executeRaw`
    UPDATE "ProductImage"
    SET url = REPLACE(url, 'http://res.cloudinary.com', 'https://res.cloudinary.com')
    WHERE url LIKE 'http://res.cloudinary.com%'
  `
  console.log(`Updated ${images} ProductImage rows`)

  const storeLogos = await prisma.$executeRaw`
    UPDATE "Store"
    SET logo = REPLACE(logo, 'http://res.cloudinary.com', 'https://res.cloudinary.com')
    WHERE logo LIKE 'http://res.cloudinary.com%'
  `
  console.log(`Updated ${storeLogos} Store logo rows`)

  const storeBanners = await prisma.$executeRaw`
    UPDATE "Store"
    SET banner = REPLACE(banner, 'http://res.cloudinary.com', 'https://res.cloudinary.com')
    WHERE banner LIKE 'http://res.cloudinary.com%'
  `
  console.log(`Updated ${storeBanners} Store banner rows`)

  const brands = await prisma.$executeRaw`
    UPDATE "Brand"
    SET logo = REPLACE(logo, 'http://res.cloudinary.com', 'https://res.cloudinary.com')
    WHERE logo LIKE 'http://res.cloudinary.com%'
  `
  console.log(`Updated ${brands} Brand logo rows`)

  console.log('Done. All http Cloudinary URLs updated to https.')
}

main().catch(console.error).finally(() => process.exit())