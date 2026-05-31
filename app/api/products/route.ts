import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    let payload = null

    // Check if user is authenticated
    if (token) {
      payload = await verifyToken(token)
    }

     // For authenticated vendors, get only their products
     if (payload && payload.role === 'VENDOR') {
       const store = await getPrisma().store.findUnique({
         where: { userId: payload.userId },
         include: {
           products: {
             include: {
               category: true,
               images: true,
               variants: true,
             },
           },
         },
       })

      if (!store) {
        const response = NextResponse.json({ products: [] })
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        response.headers.set('Pragma', 'no-cache')
        return response
      }

      const response = NextResponse.json({ products: store.products })
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
      response.headers.set('Pragma', 'no-cache')
      return response
    }

// For marketplace browsing (public or authenticated non-vendors), get all products
      // Use cached averageRating and reviewCount from Product model
      // Sort by newest first
      const products = await getPrisma().product.findMany({
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
          variants: true,
          flashSalePrice: true,
          salesPrice: true,
          dealsPrice: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

    // Use cached ratings from database
    const productsWithCachedRatings = products.map((product) => ({
      ...product,
      averageRating: product.averageRating,
      reviewCount: product.reviewCount,
    }))

    const response = NextResponse.json({ products: productsWithCachedRatings })
    // Prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    return response
  } catch (error) {
    console.error('Error fetching products:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, description, price, stock, categoryId, productCategoryId, categoryIds, imageUrls, brandId, salesPrice, dealsPrice, variants } = await request.json()

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

    // Check if vendor has completed onboarding (store and vendor category)
    const isOnboarded = await isVendorOnboarded(payload.userId);
    if (!isOnboarded) {
      return NextResponse.json({ error: 'Complete store setup before adding products' }, { status: 403 });
    }

    // Get vendor's store
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    });

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 400 })
    }

     // Create product - use first category as primary, rest will be linked via junction table
     const primaryCategoryId = uniqueCategoryIds[0]
     const product = await getPrisma().product.create({
       data: {
         storeId: store.id,
         categoryId: primaryCategoryId,
         name: name.trim(),
         description: description?.trim() || null,
         price: parseFloat(price),
         stock: parseInt(stock),
         brandId: brandId || null,
         salesPrice: salesPrice ? parseFloat(salesPrice) : null,
         dealsPrice: dealsPrice ? parseFloat(dealsPrice) : null,
       },
       include: {
         category: true,
         images: true,
       },
     })

     // Create variants if provided
     if (variants && Array.isArray(variants) && variants.length > 0) {
       await getPrisma().productVariant.createMany({
         data: variants.map((variant: any) => ({
           productId: product.id,
           color: variant.color || null,
           size: variant.size || null,
           age: variant.age || null,
           sku: variant.sku || null,
           stock: variant.stock !== undefined && variant.stock !== null ? parseInt(variant.stock) : 0,
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
    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      await getPrisma().productImage.createMany({
        data: imageUrls.map((url: string) => ({
          productId: product.id,
          url: url.trim(),
          alt: product.name,
        })),
      })

      // Refetch product with images
      const productWithImages = await getPrisma().product.findUnique({
        where: { id: product.id },
        include: {
          category: true,
          images: true,
        },
      })

      return NextResponse.json({ product: productWithImages }, { status: 201 })
    }

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}
