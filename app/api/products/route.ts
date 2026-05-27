import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'

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
            },
          },
        },
      })

      if (!store) {
        return NextResponse.json({ products: [] })
      }

      return NextResponse.json({ products: store.products })
    }

    // For marketplace browsing (public or authenticated non-vendors), get all products
    const products = await getPrisma().product.findMany({
      include: {
        category: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        images: true,
      },
    })

    return NextResponse.json({ products })
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

    const { name, description, price, stock, categoryId, productCategoryId, imageUrls } = await request.json()

    // Support both categoryId and productCategoryId for backward compatibility
    const finalCategoryId = categoryId || productCategoryId

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }
    if (!finalCategoryId) {
      return NextResponse.json({ error: 'Product category is required' }, { status: 400 })
    }
    if (price === undefined || price < 0) {
      return NextResponse.json({ error: 'Valid price is required' }, { status: 400 })
    }
    if (stock === undefined || stock < 0) {
      return NextResponse.json({ error: 'Valid stock quantity is required' }, { status: 400 })
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

    // Verify product category exists
    const productCategory = await getPrisma().productCategory.findUnique({
      where: { id: finalCategoryId },
    })

    if (!productCategory) {
      return NextResponse.json({ error: 'Invalid product category' }, { status: 400 })
    }

    // Create product
    const product = await getPrisma().product.create({
      data: {
        storeId: store!.id,
        categoryId: finalCategoryId,
        name: name.trim(),
        description: description?.trim() || null,
        price: parseFloat(price),
        stock: parseInt(stock),
      },
      include: {
        category: true,
        images: true,
      },
    })

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
