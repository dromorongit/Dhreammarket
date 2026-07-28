import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { sanitizePhoneNumber } from '@/lib/phone'
import { sanitizeUserContent } from '@/lib/sanitize'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'
import { generateSlug } from '@/lib/slug'

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

const { name, description, categoryId, logo, banner, mainPhoneNumber, alternativePhoneNumber, whatsappNumber, location, acceptsPreOrders, acceptsBackOrders } = await request.json()
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
    }
    
    // Validate main phone number is required
    if (!mainPhoneNumber || !mainPhoneNumber.trim()) {
      return NextResponse.json({ error: 'Main phone number is required' }, { status: 400 })
    }
    
    // Validate vendor category is provided and active
    // Check for both null/undefined AND empty string
    if (!categoryId || categoryId === '') {
      return NextResponse.json({ error: 'Vendor category is required' }, { status: 400 })
    }

    // Validate location is required
    if (!location || !location.trim()) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }
   
    // Input sanitization - security hardening
    const sanitizedDescription = sanitizeUserContent(description, { maxLength: 2000 })
   
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
    
      const slug = await generateSlug({ baseText: name.trim(), target: 'Store' })
    
     // Debug: Log the data being saved
    console.log('[Store API] Creating store with data:', {
      userId: payload.userId,
      name: name.trim(),
      categoryId,
      hasLogo: !!logo,
      hasBanner: !!banner,
      hasMainPhone: !!mainPhoneNumber,
    })
   
const store = await getPrisma().store.create({
          data: {
            userId: payload.userId,
            slug,
            name: name.trim(),
           description: sanitizedDescription || null,
           categoryId: categoryId,
           location: location.trim(),
           mainPhoneNumber: sanitizePhoneNumber(mainPhoneNumber),
           alternativePhoneNumber: sanitizePhoneNumber(alternativePhoneNumber),
           whatsappNumber: sanitizePhoneNumber(whatsappNumber),
           acceptsPreOrders: acceptsPreOrders || false,
           acceptsBackOrders: acceptsBackOrders || false,
           canSellProducts: true,
           canOfferServices: true,
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

    // Get existing store data for before state
    const existingStore = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

const { name, description, categoryId, logo, banner, mainPhoneNumber, alternativePhoneNumber, whatsappNumber, location, acceptsPreOrders, acceptsBackOrders } = await request.json()
    
     if (!name || !name.trim()) {
       return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
     }
    
     // Validate main phone number is required
     if (!mainPhoneNumber || !mainPhoneNumber.trim()) {
       return NextResponse.json({ error: 'Main phone number is required' }, { status: 400 })
     }
    
     // Validate vendor category is provided and active
     // Check for both null/undefined AND empty string
     if (!categoryId || categoryId === '') {
       return NextResponse.json({ error: 'Vendor category is required' }, { status: 400 })
     }

     // Validate location is required
     if (!location || !location.trim()) {
       return NextResponse.json({ error: 'Location is required' }, { status: 400 })
     }
   
     // Input sanitization - security hardening
     const sanitizedDescription = sanitizeUserContent(description, { maxLength: 2000 })
   
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
       hasMainPhone: !!mainPhoneNumber,
     })
   
const store = await getPrisma().store.update({
           where: { userId: payload.userId },
           data: {
             name: name.trim(),
             description: sanitizedDescription || null,
             categoryId: categoryId,
             location: location.trim(),
             mainPhoneNumber: sanitizePhoneNumber(mainPhoneNumber),
             alternativePhoneNumber: sanitizePhoneNumber(alternativePhoneNumber),
             whatsappNumber: sanitizePhoneNumber(whatsappNumber),
             acceptsPreOrders: acceptsPreOrders !== undefined ? acceptsPreOrders : false,
             acceptsBackOrders: acceptsBackOrders !== undefined ? acceptsBackOrders : false,
             ...(logo !== undefined && { logo }),
             ...(banner !== undefined && { banner }),
           },
          include: {
            vendor_categories: true,
          }
        })

    // Create audit log for store profile update
    if (existingStore) {
      await createAuditLog({
        userId: payload.userId,
        userRole: payload.role,
        action: 'STORE_PROFILE_UPDATED',
        entityType: 'VENDOR',
        entityId: existingStore.id,
        beforeData: {
          name: existingStore.name,
          description: existingStore.description,
          categoryId: existingStore.categoryId,
          mainPhoneNumber: existingStore.mainPhoneNumber,
          acceptsPreOrders: existingStore.acceptsPreOrders,
          acceptsBackOrders: existingStore.acceptsBackOrders,
        },
        afterData: {
          name: store.name,
          description: store.description,
          categoryId: store.categoryId,
          mainPhoneNumber: store.mainPhoneNumber,
          acceptsPreOrders: store.acceptsPreOrders,
          acceptsBackOrders: store.acceptsBackOrders,
        },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
      })
    }

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

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      categoryId,
      location,
      mainPhoneNumber,
      alternativePhoneNumber,
      whatsappNumber,
      email,
      address,
      logo,
      banner,
      acceptsPreOrders,
      acceptsBackOrders,
    } = body

    const existingStore = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!existingStore) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
      const vendorCategory = await getPrisma().vendorCategory.findUnique({
        where: { id: categoryId }
      })
      if (!vendorCategory || !vendorCategory.isActive) {
        return NextResponse.json({ error: 'Invalid or inactive vendor category' }, { status: 400 })
      }
    }

    const store = await getPrisma().store.update({
      where: { userId: payload.userId },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(location !== undefined && { location: location?.trim() || null }),
        ...(mainPhoneNumber !== undefined && { mainPhoneNumber: mainPhoneNumber || null }),
        ...(alternativePhoneNumber !== undefined && { alternativePhoneNumber: alternativePhoneNumber || null }),
        ...(whatsappNumber !== undefined && { whatsappNumber: whatsappNumber || null }),
        ...(email !== undefined && { email: email || null }),
        ...(address !== undefined && { address: address || null }),
        ...(logo !== undefined && { logo }),
        ...(banner !== undefined && { banner }),
        ...(acceptsPreOrders !== undefined && { acceptsPreOrders: acceptsPreOrders || false }),
        ...(acceptsBackOrders !== undefined && { acceptsBackOrders: acceptsBackOrders || false }),
      },
      include: { vendor_categories: true },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'STORE_PROFILE_UPDATED',
      entityType: 'VENDOR',
      entityId: existingStore.id,
      beforeData: {
        name: existingStore.name,
        description: existingStore.description,
        categoryId: existingStore.categoryId,
        mainPhoneNumber: existingStore.mainPhoneNumber,
        acceptsPreOrders: existingStore.acceptsPreOrders,
        acceptsBackOrders: existingStore.acceptsBackOrders,
      },
      afterData: {
        name: store.name,
        description: store.description,
        categoryId: store.categoryId,
        mainPhoneNumber: store.mainPhoneNumber,
        acceptsPreOrders: store.acceptsPreOrders,
        acceptsBackOrders: store.acceptsBackOrders,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    }).catch((err) => console.error('Failed to create audit log:', err))

    return NextResponse.json({ store })
  } catch (error) {
    console.error('Error patching store:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
