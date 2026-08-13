import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { createAuditLog } from '@/lib/audit-log'
import { generateSlug } from '@/lib/slug'
import { checkAndUpdateExpiredPreOrders } from '@/lib/product-availability'
import { PerformanceLogger } from '@/lib/performance'
import { sanitizeUserContent } from '@/lib/sanitize'
import { canCreateProduct } from '@/lib/subscription/feature-restriction'

export const dynamic = 'force-dynamic'
export const revalidate = 120

export async function GET(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const token = request.cookies.get('token')?.value
    let payload = null

    if (token) {
      payload = await verifyToken(token)
    }

    const url = new URL(request.url)
    const ALLOWED_SORT_FIELDS = new Set([
      'createdAt', 'price', 'name', 'stock', 'updatedAt', 'salesCount', 'reviewCount', 'averageRating'
    ])
    const rawSortBy = url.searchParams.get('sortBy') || 'createdAt'
    const sortBy = ALLOWED_SORT_FIELDS.has(rawSortBy) ? rawSortBy : 'createdAt'
    const rawSortOrder = url.searchParams.get('sortOrder') || 'desc'
    const sortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc'
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '24', 10), 1), 100)
    const skip = (page - 1) * limit
    const createdAtMin = url.searchParams.get('createdAtMin')

    if (createdAtMin && isNaN(new Date(createdAtMin).getTime())) {
      return NextResponse.json({ error: 'Invalid createdAtMin date format' }, { status: 400 })
    }

    const isVendorView = payload && payload.role === 'VENDOR'

    if (isVendorView) {
      if (!payload) {
        return NextResponse.json({ products: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })
      }
      const store = await getPrisma().store.findUnique({
        where: { userId: payload.userId },
      })

      if (!store) {
        const response = NextResponse.json({ products: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } })
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        response.headers.set('Pragma', 'no-cache')
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return response
      }

      const vendorProducts = await getPrisma().product.findMany({
        where: { storeId: store.id },
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          price: true,
          salesPrice: true,
          dealsPrice: true,
          stock: true,
          reservedQuantity: true,
          availabilityType: true,
          category: { select: { id: true, name: true, slug: true } },
        images: { take: 1, select: { id: true, url: true, alt: true } },
        },
      })

      const vendorTotal = await getPrisma().product.count({ where: { storeId: store.id } })
      perf.markPrismaEnd(prismaPerfStart)

      const productsWithStock = vendorProducts.map((p) => ({
        ...p,
        availableStock: p.stock - (p.reservedQuantity || 0),
      }))

      const response = NextResponse.json({
        products: productsWithStock,
        pagination: { page, limit, total: vendorTotal, totalPages: Math.ceil(vendorTotal / limit) },
      })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      response.headers.set('Pragma', 'no-cache')
      perf.log()
      return response
    }

    // Build where clause for public products
    const whereClause: any = {
      OR: [
        { stock: { gt: 0 } },
        { availabilityType: 'PREORDER' },
        { availabilityType: 'BACKORDER' },
      ],
    }
    if (createdAtMin) {
      whereClause.createdAt = { gte: new Date(createdAtMin) }
    }

    // Get total count for pagination
    const total = await getPrisma().product.count({ where: whereClause })

    // For marketplace browsing (public or authenticated non-vendors), get all products
    // Use cached averageRating and reviewCount from Product model
    const products = await getPrisma().product.findMany({
      where: whereClause,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        price: true,
        flashSalePrice: true,
        flashSaleStart: true,
        flashSaleEnd: true,
        salesPrice: true,
        dealsPrice: true,
        stock: true,
        reservedQuantity: true,
        salesCount: true,
        isSponsored: true,
        brand: true,
        availabilityType: true,
        expectedArrivalDate: true,
        estimatedFulfillmentDays: true,
        preOrderNotes: true,
        expectedRestockDate: true,
        backOrderNotes: true,
        averageRating: true,
        reviewCount: true,
        images: { take: 1, select: { id: true, url: true, alt: true } },
        category: { select: { id: true, name: true, slug: true } },
        brandRelation: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
        store: {
          select: {
            id: true,
            slug: true,
            name: true,
            isVerified: true,
            logo: true,
            badgeTier: true,
          },
        },
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    // Products already include averageRating and reviewCount from select
    // Add computed availableQuantity
    const productsWithCachedRatings = products.map((p: any) => ({
      ...p,
      availableQuantity: p.stock - p.reservedQuantity,
    }))

    // Compute in-memory correction for expired pre-orders (instant)
    const now = new Date()
    const expiredIds = new Set(
      productsWithCachedRatings
        .filter((p: any) => p.availabilityType === 'PREORDER' && p.expectedArrivalDate && new Date(p.expectedArrivalDate) < now)
        .map((p: any) => p.id)
    )

    // Fire-and-forget DB update for expired pre-orders
    if (expiredIds.size > 0) {
      void checkAndUpdateExpiredPreOrders(Array.from(expiredIds))
    }

    const finalProducts = productsWithCachedRatings.map((p: any) =>
      expiredIds.has(p.id) ? { ...p, availabilityType: 'IN_STOCK', expectedArrivalDate: null } : p
    )

    const totalPages = Math.ceil(total / limit)

    const response = NextResponse.json({ 
      products: finalProducts,
      pagination: { page, limit, total, totalPages }
    })
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120, max-age=30')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching products:', error)
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, description, price, stock, categoryId, productCategoryId, categoryIds, imageUrls, brandId, salesPrice, dealsPrice, variants, availabilityType, expectedArrivalDate, estimatedFulfillmentDays, preOrderNotes, expectedRestockDate, backOrderNotes } = await request.json()

    // Support both categoryId and productCategoryId for backward compatibility
    // Also support categoryIds array for multi-category selection
    const MAX_CATEGORIES = 3
    
    // Normalize categoryIds to array
    let finalCategoryIds: string[]
    if (Array.isArray(categoryIds)) {
      finalCategoryIds = categoryIds
    } else if (categoryId || productCategoryId) {
      finalCategoryIds = [categoryId || productCategoryId]
    } else {
      finalCategoryIds = []
    }

    // Validate required fields
    if (!name || !name.trim()) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }
    if (name.trim().length > 255) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Product name must be under 255 characters' }, { status: 400 })
    }
    if (finalCategoryIds.length === 0) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'At least one product category is required' }, { status: 400 })
    }
    
    // Validate max categories
    if (finalCategoryIds.length > MAX_CATEGORIES) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: `Maximum of ${MAX_CATEGORIES} categories allowed` }, { status: 400 })
    }
    
    // Validate no duplicate category IDs
    const uniqueCategoryIds = Array.from(new Set(finalCategoryIds))
    if (uniqueCategoryIds.length !== finalCategoryIds.length) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Duplicate category IDs are not allowed' }, { status: 400 })
    }
    
    // Validate all category IDs exist
    const validCategories = await getPrisma().productCategory.findMany({
      where: { id: { in: uniqueCategoryIds } },
    })
    
    if (validCategories.length !== uniqueCategoryIds.length) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'One or more invalid category IDs provided' }, { status: 400 })
    }
      const priceNum = parseFloat(price)
      if (isNaN(priceNum) || priceNum < 0) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
      }
      const stockNum = parseInt(stock, 10)
      if (isNaN(stockNum) || stockNum < 0) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Valid stock quantity is required' }, { status: 400 })
      }
     
     // Validate salesPrice and dealsPrice if provided
     if (salesPrice !== undefined && salesPrice !== null) {
       const salesPriceNum = parseFloat(salesPrice)
       if (isNaN(salesPriceNum) || salesPriceNum < 0) {
         perf.markPrismaEnd(prismaPerfStart)
         perf.log()
         return NextResponse.json({ error: 'Invalid sales price' }, { status: 400 })
       }
     }
     if (dealsPrice !== undefined && dealsPrice !== null) {
       const dealsPriceNum = parseFloat(dealsPrice)
       if (isNaN(dealsPriceNum) || dealsPriceNum < 0) {
         perf.markPrismaEnd(prismaPerfStart)
         perf.log()
         return NextResponse.json({ error: 'Invalid deals price' }, { status: 400 })
       }
      }
      if (estimatedFulfillmentDays !== undefined && estimatedFulfillmentDays !== null && estimatedFulfillmentDays !== '') {
        const daysNum = parseInt(estimatedFulfillmentDays, 10)
        if (isNaN(daysNum) || daysNum < 0) {
          perf.markPrismaEnd(prismaPerfStart)
          perf.log()
          return NextResponse.json({ error: 'Estimated fulfillment days must be a valid non-negative integer' }, { status: 400 })
        }
      }

// Check if vendor
      const isOnboarded = await isVendorOnboarded(payload.userId)
      if (!isOnboarded) {
       perf.markPrismaEnd(prismaPerfStart)
       perf.log()
       return NextResponse.json({ error: 'Complete store setup before adding products' }, { status: 403 });
     }

     // Get vendor's store
     const store = await getPrisma().store.findUnique({
       where: { userId: payload.userId },
     });

      if (!store) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: 'Store not found' }, { status: 400 })
      }

      const productLimitCheck = await canCreateProduct(payload.userId)
      if (!productLimitCheck.allowed) {
        perf.markPrismaEnd(prismaPerfStart)
        perf.log()
        return NextResponse.json({ error: productLimitCheck.reason || 'Product limit reached for your current plan. Upgrade to add more products.' }, { status: 403 })
      }

      // Validate availability type based on store settings
     const validAvailabilityTypes = ['IN_STOCK']
     if (store.acceptsPreOrders) {
       validAvailabilityTypes.push('PREORDER')
     }
     if (store.acceptsBackOrders) {
       validAvailabilityTypes.push('BACKORDER')
     }

     const finalAvailabilityType = availabilityType || 'IN_STOCK'
     if (!validAvailabilityTypes.includes(finalAvailabilityType)) {
       perf.markPrismaEnd(prismaPerfStart)
       perf.log()
       return NextResponse.json({ error: 'Invalid availability type for this store' }, { status: 400 })
     }

     // Validate preorder/backorder specific fields
     if (finalAvailabilityType === 'PREORDER') {
       if (expectedArrivalDate && isNaN(new Date(expectedArrivalDate).getTime())) {
         perf.markPrismaEnd(prismaPerfStart)
         perf.log()
         return NextResponse.json({ error: 'Invalid expected arrival date' }, { status: 400 })
       }
     }

     if (finalAvailabilityType === 'BACKORDER') {
       if (!expectedRestockDate) {
         perf.markPrismaEnd(prismaPerfStart)
         perf.log()
         return NextResponse.json({ error: 'Expected restock date is required for backorder items' }, { status: 400 })
       }
       if (isNaN(new Date(expectedRestockDate).getTime())) {
         perf.markPrismaEnd(prismaPerfStart)
         perf.log()
         return NextResponse.json({ error: 'Invalid expected restock date' }, { status: 400 })
       }
     }

     // Create product - use first category as primary, rest will be linked via junction table
     const primaryCategoryId = uniqueCategoryIds[0]

     // Generate unique slug
     const slug = await generateSlug({ baseText: name.trim(), target: 'Product' })

     const product = await getPrisma().product.create({
       data: {
         storeId: store.id,
         categoryId: primaryCategoryId,
         name: name.trim(),
         description: description?.trim() || null,
          price: parseFloat(price),
          stock: parseInt(stock, 10),
          brandId: brandId || null,
          salesPrice: salesPrice ? parseFloat(salesPrice) : null,
          dealsPrice: dealsPrice ? parseFloat(dealsPrice) : null,
          availabilityType: finalAvailabilityType as any,
          expectedArrivalDate: expectedArrivalDate ? new Date(expectedArrivalDate) : null,
          estimatedFulfillmentDays: estimatedFulfillmentDays !== undefined && estimatedFulfillmentDays !== null ? parseInt(estimatedFulfillmentDays, 10) : null,
         preOrderNotes: preOrderNotes || null,
         expectedRestockDate: expectedRestockDate ? new Date(expectedRestockDate) : null,
         backOrderNotes: backOrderNotes || null,
         slug: slug,
       },
       include: {
         category: true,
         images: true,
       },
     })
     perf.markPrismaEnd(prismaPerfStart)

      // Create variants if provided
      if (variants && Array.isArray(variants) && variants.length > 0) {
        await getPrisma().productVariant.createMany({
          data: variants.map((variant: any) => ({
            productId: product.id,
            color: variant.color || null,
            size: variant.size || null,
            age: variant.age || null,
            sku: variant.sku || null,
            stock: variant.stock !== undefined && variant.stock !== null ? parseInt(variant.stock, 10) : 0,
            active: variant.active !== undefined ? variant.active : true,
          })),
        });
      }

      // Create category assignments for all selected categories
     if (uniqueCategoryIds.length > 1) {
       await getPrisma().productCategoryAssignment.createMany({
         data: uniqueCategoryIds.map((catId, index) => ({
           productId: product.id,
           productCategoryId: catId,
           isPrimary: index === 0,
         })),
         skipDuplicates: true,
       })
     } else {
       // For single category, create the assignment record too for consistency
       await getPrisma().productCategoryAssignment.create({
         data: {
           productId: product.id,
           productCategoryId: primaryCategoryId,
           isPrimary: true,
         },
       })
     }

      // Add images if provided
      let responseProduct = product
      if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
        await getPrisma().productImage.createMany({
          data: imageUrls.map((url: string) => ({
            productId: product.id,
            url: url.trim(),
            alt: product.name,
          })),
        })

        const productWithImages = await getPrisma().product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            images: true,
          },
        })
responseProduct = productWithImages ?? product
      }

      await createAuditLog({
        userId: payload.userId,
        userRole: payload.role,
        action: 'PRODUCT_CREATED',
        entityType: 'PRODUCT',
        entityId: product.id,
        afterData: {
          name: responseProduct?.name ?? product.name,
          price: responseProduct?.price ?? product.price,
          stock: responseProduct?.stock ?? product.stock,
          categoryId: responseProduct?.categoryId ?? product.categoryId,
          storeId: responseProduct?.storeId ?? product.storeId,
        },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
      })

      perf.log()
      return NextResponse.json({ product: responseProduct }, { status: 201 })
    } catch (error) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      console.error('Error creating product:', error)
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 })
    }
  }
