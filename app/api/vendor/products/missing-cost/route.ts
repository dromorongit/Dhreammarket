import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { computeCostCoverage, findMissingCostEntries, variantLabel } from '@/lib/vendor-sales-data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vendor/products/missing-cost?page&limit
 *
 * The vendor's products and variants that still have no cost price, so the
 * cost entry screen knows what to ask for. Paged like the rest of the
 * vendor API.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const payload = outcome

    if (payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup before managing product costs' },
        { status: 403 }
      )
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      100,
    )

    const products = await getPrisma().product.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        name: true,
        price: true,
        costPrice: true,
        variants: {
          select: {
            id: true,
            color: true,
            size: true,
            age: true,
            sku: true,
            price: true,
            costPrice: true,
          },
        },
      },
    })

    const productInfos = (products as any[]).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      costPrice: product.costPrice ?? null,
      variants: (product.variants || []).map((variant: any) => ({
        id: variant.id,
        label: variantLabel(variant),
        price: variant.price ?? null,
        costPrice: variant.costPrice ?? null,
      })),
    }))

    const missing = findMissingCostEntries(productInfos)
    const coverage = computeCostCoverage(productInfos)

    const total = missing.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const items = missing.slice(start, start + limit)

    return NextResponse.json({
      items,
      pagination: { page, limit, total, totalPages },
      progress: {
        withCost: coverage.withCost,
        total: coverage.total,
        missing: coverage.missing,
        percent: coverage.percent,
      },
    })
  } catch (error) {
    console.error('Error loading products without cost prices:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}
