import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { allocateForProductStock, allocateForVariantStock } from '@/lib/stock-allocation-engine'
import { sanitizeUserContent } from '@/lib/sanitize'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'
import { fromPesewas, validateCostPrice } from '@/lib/sales-summary'
import {
  PUBLIC_PRODUCT_IMAGE_SELECT,
  PUBLIC_PRODUCT_SELECT,
  PUBLIC_VARIANT_SELECT,
} from '@/lib/public-selects'

export const runtime = 'nodejs'
export const revalidate = 60

export async function GET(
   request: NextRequest,
   { params }: { params: { id: string } }
 ) {
   try {
// The public product shape. Every field is selected on purpose: an
// `include` would ship the vendor's cost price to every guest.
const PUBLIC_PRODUCT_DETAIL_SELECT = {
      ...PUBLIC_PRODUCT_SELECT,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
          isActive: true,
        },
      },
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
          logo: true,
          isVerified: true,
          badgeTier: true,
          mainPhoneNumber: true,
        },
      },
      images: { select: PUBLIC_PRODUCT_IMAGE_SELECT },
      categoryAssignments: {
        select: {
          id: true,
          productCategoryId: true,
          isPrimary: true,
          productCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              parentId: true,
              isActive: true,
            },
          },
        },
      },
      variants: { select: PUBLIC_VARIANT_SELECT },
    }

const product = await getPrisma().product.findUnique({
        where: { slug: params.id },
        select: PUBLIC_PRODUCT_DETAIL_SELECT,
      }) ?? await getPrisma().product.findUnique({
       where: { id: params.id },
       select: PUBLIC_PRODUCT_DETAIL_SELECT,
     })

if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

    // Check if product is an expired pre-order and update it in-memory
    if (product.availabilityType === 'PREORDER' && product.expectedArrivalDate) {
      const arrivalDate = new Date(product.expectedArrivalDate)
      if (arrivalDate < new Date()) {
        product.availabilityType = 'IN_STOCK'
        product.expectedArrivalDate = null
        void getPrisma().product.updateMany({
          where: { id: product.id },
          data: {
            availabilityType: 'IN_STOCK',
            expectedArrivalDate: null,
          },
        }).catch((err) => {
          console.error('Failed to update expired pre-order:', err)
        })
      }
    }

    const productWithRating = {
      ...product,
      availableQuantity: product.stock - product.reservedQuantity,
    }

    return NextResponse.json({ product: productWithRating })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'Complete store setup before managing products' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 })
    }

    const product = await getPrisma().product.findUnique({
      where: { id: params.id },
      select: { availabilityType: true, storeId: true },
    })

    if (!product || product.storeId !== store.id) {
      return NextResponse.json({ count: 0 })
    }

    const { type } = await request.json()

    if (type === 'waiting-customers') {
      const prisma = getPrisma()
      if (!product.availabilityType) {
        return NextResponse.json({ count: 0 })
      }

      const orderType = product.availabilityType === 'PREORDER' ? 'PREORDER' : 'BACKORDER'
      const count = await prisma.order.count({
        where: {
          orderType,
          paymentStatus: 'PAID',
          status: { in: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
          items: { some: { productId: params.id } },
        },
      })

      return NextResponse.json({ count })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    console.error('Error fetching waiting customers:', error)
    return NextResponse.json({ count: 0 }, { status: 500 })
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

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = outcome
    if (payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, price, stock, lowStockThreshold, categoryId, productCategoryId, categoryIds, imageUrls, brandId, salesPrice, dealsPrice, costPrice, variants, availabilityType, expectedArrivalDate, estimatedFulfillmentDays, preOrderNotes, expectedRestockDate, backOrderNotes, isReturnable } = body

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
    if (name.trim().length > 255) {
      return NextResponse.json({ error: 'Product name must be under 255 characters' }, { status: 400 })
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
    
    const priceNum = parseFloat(price)
    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
    }
    const stockNum = parseInt(stock, 10)
    if (isNaN(stockNum) || stockNum < 0) {
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

    // Cost price: only written when the caller sends the key, so an older
    // client that does not know about costs can never wipe them.
    const hasCostPrice = Object.prototype.hasOwnProperty.call(body, 'costPrice')
    let productCostPrice: number | null | undefined = undefined
    if (hasCostPrice) {
      const costPriceResult = validateCostPrice(costPrice)
      if ('error' in costPriceResult) {
        return NextResponse.json({ error: costPriceResult.error }, { status: 400 })
      }
      productCostPrice = costPriceResult.provided ? fromPesewas(costPriceResult.pesewas) : null
    }

    // Variant cost prices are validated the same way. `undefined` means
    // "leave this variant's cost alone".
    const variantCostPrices = new Map<number, number | null | undefined>()
    if (Array.isArray(variants)) {
      for (let index = 0; index < variants.length; index += 1) {
        const variant = variants[index]
        if (!variant || !Object.prototype.hasOwnProperty.call(variant, 'costPrice')) {
          variantCostPrices.set(index, undefined)
          continue
        }
        const variantCostResult = validateCostPrice(variant.costPrice)
        if ('error' in variantCostResult) {
          return NextResponse.json({ error: variantCostResult.error }, { status: 400 })
        }
        variantCostPrices.set(
          index,
          variantCostResult.provided ? fromPesewas(variantCostResult.pesewas) : null,
        )
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
      select: {
        id: true,
        storeId: true,
        name: true,
        price: true,
        stock: true,
        lowStockThreshold: true,
        categoryId: true,
        brandId: true,
        availabilityType: true,
      },
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

if (finalAvailabilityType === 'PREORDER') {
      if (expectedArrivalDate && isNaN(new Date(expectedArrivalDate).getTime())) {
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
    const sanitizedDescription = sanitizeUserContent(description, { maxLength: 5000 })
    const sanitizedPreOrderNotes = sanitizeUserContent(preOrderNotes, { maxLength: 1000 })
    const sanitizedBackOrderNotes = sanitizeUserContent(backOrderNotes, { maxLength: 1000 })

    // Capture before data for audit
    const beforeData = {
      name: existingProduct.name,
      price: existingProduct.price,
      stock: existingProduct.stock,
      lowStockThreshold: existingProduct.lowStockThreshold,
      categoryId: existingProduct.categoryId,
      brandId: existingProduct.brandId,
      availabilityType: existingProduct.availabilityType,
    }

    const product = await getPrisma().product.update({
      where: { id: params.id },
      data: {
        categoryId: primaryCategoryId,
        name: name.trim(),
        description: sanitizedDescription || null,
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold, 10) : 5,
        brandId: brandId || null,
        salesPrice: salesPrice ? parseFloat(salesPrice) : null,
        dealsPrice: dealsPrice ? parseFloat(dealsPrice) : null,
        ...(productCostPrice !== undefined ? { costPrice: productCostPrice } : {}),
        availabilityType: finalAvailabilityType as any,
        expectedArrivalDate: expectedArrivalDate ? new Date(expectedArrivalDate) : null,
        estimatedFulfillmentDays: estimatedFulfillmentDays !== undefined && estimatedFulfillmentDays !== null ? parseInt(estimatedFulfillmentDays, 10) : null,
        preOrderNotes: sanitizedPreOrderNotes || null,
        expectedRestockDate: expectedRestockDate ? new Date(expectedRestockDate) : null,
        backOrderNotes: sanitizedBackOrderNotes || null,
        isReturnable: isReturnable !== false,
      },
      include: {
        category: true,
        images: true,
        variants: true,
      },
    })

    // Create audit log for product update
    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: params.id,
      beforeData,
      afterData: {
        name: product.name,
        price: product.price,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        categoryId: product.categoryId,
        brandId: product.brandId,
        availabilityType: product.availabilityType,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
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
          data: imageUrls.map((url: string) => {
            const trimmed = url.trim()
            const isVideo = /\/video\/upload\//.test(trimmed)
            return {
              productId: params.id,
              url: trimmed,
              alt: product.name,
              mediaType: isVideo ? 'video' : 'image',
            }
          }),
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
      for (let variantIndex = 0; variantIndex < incomingVariants.length; variantIndex += 1) {
        const variant = incomingVariants[variantIndex]
        const variantCostPrice = variantCostPrices.get(variantIndex)
        const variantCostData =
          variantCostPrice === undefined ? {} : { costPrice: variantCostPrice }
        const variantStock = variant.stock !== undefined && variant.stock !== null ? parseInt(variant.stock, 10) : 0

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
               price: variant.price !== undefined && variant.price !== null && variant.price !== '' ? parseFloat(variant.price) : null,
               stock: variantStock,
               active: variant.active !== undefined ? variant.active : true,
               ...variantCostData,
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
              price: variant.price !== undefined && variant.price !== null && variant.price !== '' ? parseFloat(variant.price) : null,
              stock: variantStock,
              active: variant.active !== undefined ? variant.active : true,
              ...variantCostData,
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
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
      where: { id },
      select: { id: true, storeId: true, name: true, price: true, stock: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.storeId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check for existing restock orders
    const restockOrdersCount = await getPrisma().restockOrder.count({
      where: { productId: id },
    })
    if (restockOrdersCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete product with pending restock orders. Cancel or wait for them to complete first.' 
      }, { status: 400 })
    }

    // Check for existing purchase order items
    const purchaseOrderItemsCount = await getPrisma().purchaseOrderItem.count({
      where: { productId: id },
    })
    if (purchaseOrderItemsCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete product linked to purchase orders. Remove from purchase orders first.' 
      }, { status: 400 })
    }

    // Check for existing order items
    const orderItemCount = await getPrisma().orderItem.count({
      where: { productId: id },
    })
    if (orderItemCount > 0) {
      return NextResponse.json(
        { error: 'This product has order history and cannot be deleted. Set stock to 0 to stop sales.' },
        { status: 409 }
      )
    }

    // Create audit log before deletion
    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'PRODUCT_DELETED',
      entityType: 'PRODUCT',
      entityId: id,
      beforeData: {
        id: product.id,
        name: product.name,
        storeId: product.storeId,
        price: product.price,
        stock: product.stock,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    // Delete product (cascade will handle images)
    await getPrisma().product.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting product:', error)
    
    // Handle Prisma foreign key constraint errors
    if (error.code === 'P2003' || error.code === 'P2006') {
      return NextResponse.json({ 
        error: 'Cannot delete product because it is referenced by other records. Please remove related orders, restock orders, or purchase orders first.' 
      }, { status: 400 })
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error'
    }, { status: 500 })
  }
}