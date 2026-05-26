import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const store = await getPrisma().store.findUnique({
        where: { userId: payload.userId },
        include: {
          vendor_categories: true,
        },
      })
  
      if (!store) {
        return NextResponse.json({ store: null })
      }
  
      return NextResponse.json({ store })
  } catch (error) {
    console.error('Error fetching store:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
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

    const { name, description, categoryId, logo, banner } = await request.json()
  
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
    }
  
    // Validate vendor category is provided and active
    // Check for both null/undefined AND empty string
    if (!categoryId || categoryId === '') {
      return NextResponse.json({ error: 'Vendor category is required' }, { status: 400 })
    }
  
    const vendorCategory = await getPrisma().vendorCategory.findUnique({
      where: { id: categoryId }
    })
    if (!vendorCategory || !vendorCategory.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive vendor category' }, { status: 400 })
    }
  
    // Check if store already exists
    const existingStore = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })
  
    if (existingStore) {
      return NextResponse.json({ error: 'Store already exists' }, { status: 400 })
    }
  
    // Debug: Log the data being saved
    console.log('[Store API] Creating store with data:', {
      userId: payload.userId,
      name: name.trim(),
      categoryId,
      hasLogo: !!logo,
      hasBanner: !!banner,
    })
  
    const store = await getPrisma().store.create({
        data: {
          userId: payload.userId,
          name: name.trim(),
          description: description?.trim() || null,
          categoryId: categoryId, // Already validated above, no need for || null
          ...(logo !== undefined && { logo }),
          ...(banner !== undefined && { banner }),
        },
        include: {
          vendor_categories: true,
        }
      })
  
    // Debug: Log the created store
    console.log('[Store API] Store created successfully:', {
      storeId: store.id,
      categoryId: store.categoryId,
    })
  
    return NextResponse.json({ store }, { status: 201 })
  } catch (error) {
    console.error('Error creating store:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, description, categoryId, logo, banner } = await request.json()
  
     if (!name || !name.trim()) {
       return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
     }
  
     // Validate vendor category is provided and active
     // Check for both null/undefined AND empty string
     if (!categoryId || categoryId === '') {
       return NextResponse.json({ error: 'Vendor category is required' }, { status: 400 })
     }
  
     const vendorCategory = await getPrisma().vendorCategory.findUnique({
       where: { id: categoryId }
     })
     if (!vendorCategory || !vendorCategory.isActive) {
       return NextResponse.json({ error: 'Invalid or inactive vendor category' }, { status: 400 })
     }
  
     // Debug: Log the data being updated
     console.log('[Store API] Updating store with data:', {
       userId: payload.userId,
       name: name.trim(),
       categoryId,
       hasLogo: !!logo,
       hasBanner: !!banner,
     })
  
     const store = await getPrisma().store.update({
       where: { userId: payload.userId },
       data: {
         name: name.trim(),
         description: description?.trim() || null,
         categoryId: categoryId,
         ...(logo !== undefined && { logo }),
         ...(banner !== undefined && { banner }),
       },
       include: {
         vendor_categories: true,
       }
     })
  
    // Debug: Log the updated store
    console.log('[Store API] Store updated successfully:', {
      storeId: store.id,
      categoryId: store.categoryId,
    })
  
    return NextResponse.json({ store })
  } catch (error) {
    console.error('Error updating store:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}