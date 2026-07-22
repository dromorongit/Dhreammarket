import { getPrisma } from '@/lib/prisma'
import { PrismaClient } from '@prisma/client'

export type SlugTarget = 'Store' | 'Product' | 'ProductCategory' | 'Brand'

export interface SlugOptions {
  baseText: string
  target: SlugTarget
  excludeId?: string
  prismaClient?: any
}

const prismaModelName: Record<SlugTarget, string> = {
  Store: 'store',
  Product: 'product',
  ProductCategory: 'productCategory',
  Brand: 'brand',
}

export async function generateSlug({
  baseText,
  target,
  excludeId,
  prismaClient,
}: SlugOptions): Promise<string> {
  const prisma = prismaClient || getPrisma()

  let slug = baseText
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!slug) {
    slug = 'item'
  }

  let uniqueSlug = slug
  let counter = 1
  const maxAttempts = 1000

  while (counter <= maxAttempts) {
    const where: any = { slug: uniqueSlug }
    if (excludeId) {
      where.id = { not: excludeId }
    }

    const modelKey = prismaModelName[target]
    const existing = await (prisma as any)[modelKey].findFirst({
      where,
      select: { id: true },
    })

    if (!existing) {
      return uniqueSlug
    }

    uniqueSlug = `${slug}-${counter}`
    counter++
  }

  return `${slug}-${Date.now()}`
}
