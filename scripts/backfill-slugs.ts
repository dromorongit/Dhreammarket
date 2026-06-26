import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { slugify } from '../lib/slugify'
import 'dotenv/config'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  maxUses: 7500,
  ssl: {
    rejectUnauthorized: false,
    ca: undefined,
  },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function backfillStores() {
  const stores = await prisma.store.findMany({
    where: { slug: { equals: null } },
    select: { id: true, name: true },
  })

  let count = 0
  for (const store of stores) {
    let slug = slugify(store.name)
    let attempt = 1
    const existing = await prisma.store.findUnique({ where: { slug } })
    while (existing !== null) {
      attempt++
      slug = `${slugify(store.name)}-${attempt}`
    }
    await prisma.store.update({
      where: { id: store.id },
      data: { slug },
    })
    console.log(`Store: ${store.name} → ${slug}`)
    count++
  }
  return count
}

async function backfillProducts() {
  const products = await prisma.product.findMany({
    where: { slug: { equals: null } },
    select: { id: true, name: true },
  })

  let count = 0
  for (const product of products) {
    let slug = slugify(product.name)
    let attempt = 1
    const existing = await prisma.product.findUnique({ where: { slug } })
    while (existing !== null) {
      attempt++
      slug = `${slugify(product.name)}-${attempt}`
    }
    await prisma.product.update({
      where: { id: product.id },
      data: { slug },
    })
    console.log(`Product: ${product.name} → ${slug}`)
    count++
  }
  return count
}

async function main() {
  const storeCount = await backfillStores()
  const productCount = await backfillProducts()
  console.log(`Done. Stores: ${storeCount}, Products: ${productCount}`)
  await prisma.$disconnect()
}

main()