import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'
import { generateSlug } from '@/lib/slug'
import { sanitizeUserContent } from '@/lib/sanitize'

export const runtime = 'nodejs'
export const revalidate = 60

export async function GET(
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

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const service = await getPrisma().service.findUnique({
      where: { id: params.id },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        store: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
          select: { id: true, imageUrl: true, displayOrder: true },
        },
      },
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (service.vendorId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ service })
  } catch (error) {
    console.error('Error fetching service:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
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

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const existingService = await getPrisma().service.findUnique({
      where: { id: params.id },
    })

    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (existingService.vendorId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      shortDescription,
      startingPrice,
      pricingType,
      deliveryType,
      availabilityStatus,
      categoryId,
      status,
      thumbnail,
      gallery,
      requirementsFromCustomer,
      estimatedDeliveryTime,
      tags,
      isFeatured,
      images,
    } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Service title is required' }, { status: 400 })
    }

    if (!categoryId) {
      return NextResponse.json({ error: 'Service category is required' }, { status: 400 })
    }

    const category = await getPrisma().serviceCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category) {
      return NextResponse.json({ error: 'Service category not found' }, { status: 404 })
    }

    const sanitizedDescription = sanitizeUserContent(description, { maxLength: 5000 })
    const sanitizedShortDescription = sanitizeUserContent(shortDescription, { maxLength: 500 })
    const sanitizedRequirements = sanitizeUserContent(requirementsFromCustomer, { maxLength: 2000 })

    const beforeData = {
      title: existingService.title,
      startingPrice: existingService.startingPrice,
      pricingType: existingService.pricingType,
      availabilityStatus: existingService.availabilityStatus,
      status: existingService.status,
      categoryId: existingService.categoryId,
    }

    const updateData: Record<string, unknown> = {
      title: title.trim(),
      description: sanitizedDescription || null,
      shortDescription: sanitizedShortDescription || null,
      startingPrice: startingPrice !== undefined ? parseFloat(startingPrice) : existingService.startingPrice,
      pricingType: pricingType || existingService.pricingType,
      deliveryType: deliveryType || existingService.deliveryType,
      availabilityStatus: availabilityStatus || existingService.availabilityStatus,
      categoryId,
      status: status || existingService.status,
      requirementsFromCustomer: sanitizedRequirements || null,
      estimatedDeliveryTime: estimatedDeliveryTime?.trim() || null,
      tags: Array.isArray(tags) ? tags : existingService.tags,
      isFeatured: isFeatured !== undefined ? isFeatured : existingService.isFeatured,
    }

    if (thumbnail !== undefined) {
      updateData.thumbnail = thumbnail || null
    }

    if (gallery !== undefined) {
      updateData.gallery = Array.isArray(gallery) ? gallery : []
    }

    const service = await getPrisma().service.update({
      where: { id: params.id },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
          select: { id: true, imageUrl: true, displayOrder: true },
        },
      },
    })

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'SERVICE_UPDATED',
      entityType: 'SERVICE',
      entityId: params.id,
      beforeData,
      afterData: {
        title: service.title,
        startingPrice: service.startingPrice,
        pricingType: service.pricingType,
        availabilityStatus: service.availabilityStatus,
        status: service.status,
        categoryId: service.categoryId,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    // Handle images update if provided
    if (images !== undefined) {
      await getPrisma().serviceImage.deleteMany({
        where: { serviceId: params.id },
      })

      if (Array.isArray(images) && images.length > 0) {
        await getPrisma().serviceImage.createMany({
          data: images.map((img: { imageUrl: string; displayOrder?: number }, index: number) => ({
            serviceId: params.id,
            imageUrl: img.imageUrl,
            displayOrder: img.displayOrder !== undefined ? img.displayOrder : index,
          })),
        })
      }

      const serviceWithImages = await getPrisma().service.findUnique({
        where: { id: params.id },
        include: {
          images: {
            orderBy: { displayOrder: 'asc' },
            select: { id: true, imageUrl: true, displayOrder: true },
          },
        },
      })

      return NextResponse.json({ service: serviceWithImages })
    }

    return NextResponse.json({ service })
  } catch (error) {
    console.error('Error updating service:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
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

    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    })

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    const service = await getPrisma().service.findUnique({
      where: { id: params.id },
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (service.vendorId !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await createAuditLog({
      userId: payload.userId,
      userRole: payload.role,
      action: 'SERVICE_DELETED',
      entityType: 'SERVICE',
      entityId: params.id,
      beforeData: {
        id: service.id,
        title: service.title,
        vendorId: service.vendorId,
        categoryId: service.categoryId,
      },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
    })

    await getPrisma().service.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Service deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting service:', error)

    if (error.code === 'P2003' || error.code === 'P2006') {
      return NextResponse.json({
        error: 'Cannot delete service because it is referenced by other records. Please remove related records first.',
      }, { status: 400 })
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}
