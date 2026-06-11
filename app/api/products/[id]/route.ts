import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { allocateForProductStock, allocateForVariantStock } from '@/lib/stock-allocation-engine'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const product = await getPrisma().product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
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
            name: true,
            isVerified: true,
          },
        },
        images: true,
        productReviews: {
          select: {
            rating: true,
          },
        },
        categoryAssignments: {
          include: {
            productCategory: true,
          },
        },
        variants: true,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Calculate average rating
    const reviews = product.productReviews || []
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviews.length
      : 0

    const productWithRating = {
      ...product,
      averageRating: parseFloat(avgRating.toFixed(1)),
      reviewCount: reviews.length,
      availableQuantity: product.stock - product.reservedQuantity,
    }

    return NextResponse.json({ product: productWithRating })
  } catch (error) {
    console.error('Error fetching product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, description, price, stock, lowStockThreshold, categoryId, productCategoryId, categoryIds, imageUrls, brandId, salesPrice, dealsPrice, variants, availabilityType, expectedArrivalDate, estimatedFulfillmentDays, preOrderNotes, expectedRestockDate, backOrderNotes } = await request.json()

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

    // Check if vendor has completed onboarding (store and vendor category)
    const isOnboarded = await isVendorOnboarded(payload.userId);
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup before adding products' }, { status: 403 });
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }
    if (finalCategoryIds.length === 0) {
      return NextResponse.json({ error: 'At least one product category is required' }, { status: 400 })
    }
    
    // Validate max categories
    if (finalCategoryIds.length > MAX_CATEGORIES) {
      return NextResponse.json({ error: `Maximum of ${MAX_CATEGORIES} categories allowed` }, { status: 400 })
    }
    
    // Validate no duplicate category IDs
    const uniqueCategoryIds = Array.from(new Set(finalCategoryIds))
    if (uniqueCategoryIds.length !== finalCategoryIds.length) {
      return NextResponse.json({ error: 'Duplicate category IDs are not allowed' }, { status: 400 })
    }
    
    // Validate all category IDs exist
    const validCategories = await getPrisma().productCategory.findMany({
      where: { id: { in: uniqueCategoryIds } },
    })
    
    if (validCategories.length !== uniqueCategoryIds.length) {
      return NextResponse.json({ error: 'One or more invalid category IDs provided' }, { status: 400 })
    }
    
    if (price === undefined || price < 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
    }
    if (stock === undefined || stock < 0) {
      return NextResponse.json({ error: 'Valid stock quantity is required' }, { status: 400 })
    }
    
    // Validate salesPrice and dealsPrice if provided
    if (salesPrice !== undefined && salesPrice !== null) {
      const salesPriceNum = parseFloat(salesPrice)
      if (isNaN(salesPriceNum) || salesPriceNum < 0) {
        return NextResponse.json({ error: 'Invalid sales price' }, { status: 400 })
      }
    }
    if (dealsPrice !== undefined && dealsPrice !== null) {
      const dealsPriceNum = parseFloat(dealsPrice)
      if (isNaN(dealsPriceNum) || dealsPriceNum < 0) {
        return NextResponse.json({ error: 'Invalid deals price' }, { status: 400 })
      }
    }

    // Get vendor's store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 })
    }

    // Check if product exists and belongs to vendor
    const existingProduct = await getPrisma().product.findUnique({
      where: { id: params.id },
    })

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (existingProduct.storeId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      return NextResponse.json({ error: 'Invalid availability type for this store' }, { status: 400 })
    }

    // Validate preorder/backorder specific fields
    if (finalAvailabilityType === 'PREORDER') {
      if (!expectedArrivalDate) {
        return NextResponse.json({ error: 'Expected arrival date is required for preorder items' }, { status: 400 })
      }
      if (isNaN(new Date(expectedArrivalDate).getTime())) {
        return NextResponse.json({ error: 'Invalid expected arrival date' }, { status: 400 })
      }
    }

    if (finalAvailabilityType === 'BACKORDER') {
      if (!expectedRestockDate) {
        return NextResponse.json({ error: 'Expected restock date is required for backorder items' }, { status: 400 })
      }
      if (isNaN(new Date(expectedRestockDate).getTime())) {
        return NextResponse.json({ error: 'Invalid expected restock date' }, { status: 400 })
      }
    }

    // Update product - use first category as primary
    const primaryCategoryId = uniqueCategoryIds[0]
    const product = await getPrisma().product.update({
      where: { id: params.id },
      data: {
        categoryId: primaryCategoryId,
        name: name.trim(),
        description: description?.trim() || null,
        price: parseFloat(price),
        stock: parseInt(stock),
        lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : 5,
        brandId: brandId || null,
        salesPrice: salesPrice ? parseFloat(salesPrice) : null,
        dealsPrice: dealsPrice ? parseFloat(dealsPrice) : null,
        availabilityType: finalAvailabilityType as any,
        expectedArrivalDate: expectedArrivalDate ? new Date(expectedArrivalDate) : null,
        estimatedFulfillmentDays: estimatedFulfillmentDays !== undefined && estimatedFulfillmentDays !== null ? parseInt(estimatedFulfillmentDays) : null,
        preOrderNotes: preOrderNotes || null,
        expectedRestockDate: expectedRestockDate ? new Date(expectedRestockDate) : null,
        backOrderNotes: backOrderNotes || null,
      },
      include: {
        category: true,
        images: true,
        variants: true,
      },
    })

    // Update category assignments
    // Delete existing assignments
    await getPrisma().productCategoryAssignment.deleteMany({
      where: { productId: params.id },
    })

    // Create new assignments
    if (uniqueCategoryIds.length > 0) {
      await getPrisma().productCategoryAssignment.createMany({
        data: uniqueCategoryIds.map((catId, index) => ({
          productId: params.id,
          productCategoryId: catId,
          isPrimary: index === 0,
        })),
        skipDuplicates: true,
      })
    }

    // Handle images update
    if (imageUrls !== undefined) {
      // Delete existing images
      await getPrisma().productImage.deleteMany({
        where: { productId: params.id },
      })

      // Add new images if provided
      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        await getPrisma().productImage.createMany({
          data: imageUrls.map((url: string) => ({
            productId: params.id,
            url: url.trim(),
            alt: product.name,
          })),
        })
      }
    }

    // Handle variants update incrementally to track stock changes and trigger allocation
    if (variants !== undefined) {
      // Get existing variants to compare stock changes
      const existingVariants = await getPrisma().productVariant.findMany({
        where: { productId: params.id },
        select: { id: true, stock: true },
      })

      const existingVariantMap = new Map(existingVariants.map(v => [v.id, v.stock]))
      const incomingVariants = variants as any[]

      // Delete variants that are no longer present
      const incomingIds = incomingVariants.filter(v => v.id).map(v => v.id)
      if (incomingIds.length > 0) {
        await getPrisma().productVariant.deleteMany({
          where: { productId: params.id, id: { notIn: incomingIds } },
        })
      } else {
        await getPrisma().productVariant.deleteMany({
          where: { productId: params.id },
        })
      }

      // Process updates and creates
      for (const variant of incomingVariants) {
        const variantStock = variant.stock !== undefined && variant.stock !== null ? parseInt(variant.stock) : 0

        if (variant.id) {
          // Update existing variant
          const previousStock = existingVariantMap.get(variant.id) ?? 0

          await getPrisma().productVariant.update({
            where: { id: variant.id },
            data: {
              productId: params.id,
              color: variant.color || null,
              size: variant.size || null,
              age: variant.age || null,
              sku: variant.sku || null,
              stock: variantStock,
              active: variant.active !== undefined ? variant.active : true,
            },
          })

          // Trigger allocation if stock increased
          if (variantStock > previousStock) {
            allocateForVariantStock(variant.id, previousStock, variantStock, payload.userId).then(result => {
              if (result.success && result.allocatedOrders.length > 0) {
                console.log(`[Stock Allocation] Allocated ${result.allocatedOrders.length} orders for variant ${variant.id}`)
              }
            }).catch(err => {
              console.error('Failed to allocate variant stock:', err)
            })
          }
        } else {
          // Create new variant - no need to trigger allocation as it's new
          await getPrisma().productVariant.create({
            data: {
              productId: params.id,
              color: variant.color || null,
              size: variant.size || null,
              age: variant.age || null,
              sku: variant.sku || null,
              stock: variantStock,
              active: variant.active !== undefined ? variant.active : true,
            },
          })
        }
      }
    }

    // Refetch product with all updates
    const productWithUpdates = await getPrisma().product.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        images: true,
        variants: true,
        brandRelation: true,
      },
    })

    return NextResponse.json({ product: productWithUpdates })
  } catch (error) {
    console.error('Error updating product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if vendor has completed onboarding (store and category)
    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup before managing products' }, { status: 403 })
    }

    // Get vendor's store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 })
    }

    // Check if product exists and belongs to vendor
    const product = await getPrisma().product.findUnique({
      where: { id: params.id },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.storeId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete product (cascade will handle images)
    await getPrisma().product.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}