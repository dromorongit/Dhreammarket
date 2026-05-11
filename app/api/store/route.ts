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
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    return NextResponse.json({ store })
  } catch (error) {
    console.error('Error fetching store:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    // Validate category is provided and active
    if (!categoryId) {
      return NextResponse.json({ error: 'Vendor category is required' }, { status: 400 })
    }
    
    const category = await getPrisma().vendorCategory.findUnique({
      where: { id: categoryId }
    })
    if (!category || !category.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive vendor category' }, { status: 400 })
    }

    // Check if store already exists
    const existingStore = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (existingStore) {
      return NextResponse.json({ error: 'Store already exists' }, { status: 400 })
    }

    const store = await getPrisma().store.create({
      data: {
        userId: payload.userId,
        name: name.trim(),
        description: description?.trim() || null,
        categoryId: categoryId || null,
        ...(logo !== undefined && { logo }),
        ...(banner !== undefined && { banner }),
      },
      include: {
        category: true,
      }
    })

    return NextResponse.json({ store }, { status: 201 })
  } catch (error) {
    console.error('Error creating store:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

   // Validate category is provided and active
   if (!categoryId) {
     return NextResponse.json({ error: 'Vendor category is required' }, { status: 400 })
   }
   
   const category = await getPrisma().vendorCategory.findUnique({
     where: { id: categoryId }
   })
   if (!category || !category.isActive) {
     return NextResponse.json({ error: 'Invalid or inactive vendor category' }, { status: 400 })
   }

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
        category: true,
      }
    })

     return NextResponse.json({ store })
   } catch (error) {
     console.error('Error updating store:', error)
     return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
   }
}