import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

const MAX_PRODUCTS_PER_RUN = 500
const MAX_PRODUCTS_PER_VENDOR_MESSAGE = 5

function unique<T extends string | number | symbol>(items: T[]): T[] {
  const seen: Record<T, true> = {} as Record<T, true>
  const out: T[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!seen[item]) {
      seen[item] = true
      out.push(item)
    }
  }
  return out
}

interface LowStockProduct {
  id: string
  name: string
  stock: number
  reservedQuantity: number
  lowStockThreshold: number
  storeId: string
}

export async function runLowStockAlerts() {
  const prisma = getPrisma()

  // 1. Candidate low-stock products, oldest first, capped per run.
  // Already-alerted products (lowStockAlertedAt set) are excluded so they
  // never consume the 500 cap; only new low-stock products compete for the
  // slots. The products table has no deletedAt/isActive column, so no
  // deleted/active filter can be applied; low stock means available stock
  // (stock - reservedQuantity) is at or below the per-product lowStockThreshold.
  // ORDER BY id (unique) makes candidate selection deterministic so each run
  // makes progress instead of re-scanning the same createdAt ties.
  const candidates = await prisma.$queryRaw<Array<LowStockProduct>>`
    SELECT id, name, stock, "reservedQuantity", "lowStockThreshold", "storeId"
    FROM products
    WHERE (stock - "reservedQuantity") <= "lowStockThreshold"
      AND "lowStockAlertedAt" IS NULL
    ORDER BY "id" ASC
    LIMIT ${MAX_PRODUCTS_PER_RUN}
  `

  // 2. Skip products with variants: variant stock is tracked independently in
  // product_variants, so product.stock is not guaranteed to equal total stock.
  // Alerts stay product-level only.
  const candidateIds = candidates.map((p) => p.id)
  let claimable = candidates
  if (candidateIds.length > 0) {
    const productsWithVariants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT "productId" AS id
      FROM product_variants
      WHERE "productId" IN (${candidateIds})
    `
    const withVariantIds = new Set<string>()
    for (let i = 0; i < productsWithVariants.length; i++) {
      withVariantIds.add(productsWithVariants[i].id)
    }
    claimable = candidates.filter((p) => !withVariantIds.has(p.id))
  }

  // 3. Atomic claim: only unclaimed products are alerted this run.
  const claimableIds = claimable.map((p) => p.id)
  const claimed: Array<{ id: string }> = []
  if (claimableIds.length > 0) {
    claimed.push(
      ...(await prisma.$queryRaw<Array<{ id: string }>>`
        UPDATE "products"
        SET "lowStockAlertedAt" = now()
        WHERE "id" IN (${claimableIds}) AND "lowStockAlertedAt" IS NULL
        RETURNING "id"
      `)
    )
  }
  const claimedIds = new Set<string>()
  for (let i = 0; i < claimed.length; i++) {
    claimedIds.add(claimed[i].id)
  }
  const claimedProducts = claimable.filter((p) => claimedIds.has(p.id))

  // 4. Recovery: clear alert state for products back above threshold.
  let recovered = 0
  const recovery = await prisma.$executeRaw`
    UPDATE "products"
    SET "lowStockAlertedAt" = NULL
    WHERE "lowStockAlertedAt" IS NOT NULL
      AND (stock - "reservedQuantity") > "lowStockThreshold"
  `
  recovered = Number(recovery)

  // 5. Group claimed products by the store's vendor user and notify.
  let vendors = 0
  const failed: string[] = []

  if (claimedProducts.length > 0) {
    const storeIds = unique(claimedProducts.map((p) => p.storeId))
    const stores = await prisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, userId: true },
    })
    const storeVendor = new Map<string, string>()
    for (let i = 0; i < stores.length; i++) {
      storeVendor.set(stores[i].id, stores[i].userId)
    }

    const vendorIds = unique(stores.map((s) => s.userId))
    const settings = await prisma.vendorSettings.findMany({
      where: { userId: { in: vendorIds } },
      select: { userId: true, notifyLowStock: true },
    })
    const notifyEnabled = new Map<string, boolean>()
    for (let i = 0; i < settings.length; i++) {
      notifyEnabled.set(settings[i].userId, settings[i].notifyLowStock !== false)
    }

    const byVendor = new Map<string, Array<LowStockProduct>>()
    const vendorOrder: string[] = []
    for (const product of claimedProducts) {
      const userId = storeVendor.get(product.storeId)
      if (!userId) continue
      let list = byVendor.get(userId)
      if (!list) {
        list = []
        byVendor.set(userId, list)
        vendorOrder.push(userId)
      }
      list.push(product)
    }

    for (let i = 0; i < vendorOrder.length; i++) {
      const userId = vendorOrder[i]
      const products = byVendor.get(userId)!
      try {
        if (notifyEnabled.get(userId) === false) continue

        const listed = products.slice(0, MAX_PRODUCTS_PER_VENDOR_MESSAGE)
        const more = products.length - MAX_PRODUCTS_PER_VENDOR_MESSAGE
        const items = listed
          .map((p: LowStockProduct) => {
            const available = p.stock - p.reservedQuantity
            return `${p.name} (${available <= 0 ? 'out of stock' : available + ' left'})`
          })
          .join(', ')
        const suffix = more > 0 ? ` +${more} more` : ''

        await createNotification(
          userId,
          'LOW_STOCK',
          'Low stock alert',
          `Low stock: ${items}${suffix}. Restock soon to avoid selling out.`
        )
        vendors++
      } catch (err) {
        console.error(`[Low Stock Alerts] Failed to notify vendor ${userId}:`, err)
        failed.push(userId)
      }
    }
  }

  return {
    products: claimedProducts.length,
    vendors,
    recovered,
    failed: failed.length,
  }
}
