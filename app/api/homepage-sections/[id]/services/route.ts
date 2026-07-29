import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

// POST /api/homepage-sections/[id]/services - Add services to a section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const { id } = await params
    const { serviceIds } = await request.json()

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return NextResponse.json(
        { error: 'serviceIds array is required' },
        { status: 400 }
      )
    }

    const section = await prisma.homepageSection.findUnique({
      where: { id },
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
    })

    if (services.length !== serviceIds.length) {
      return NextResponse.json(
        { error: 'Some services were not found' },
        { status: 404 }
      )
    }

    const settings = (section.settings || {}) as Record<string, any>
    const existingServiceIds = settings.serviceIds || []
    const newServiceIds = serviceIds.filter(
      (sid: string) => !existingServiceIds.includes(sid)
    )

    if (newServiceIds.length > 0) {
      const updatedServiceIds = [...existingServiceIds, ...newServiceIds]
      await prisma.homepageSection.update({
        where: { id },
        data: {
          settings: {
            ...settings,
            serviceIds: updatedServiceIds,
          },
        },
      })
    }

    const updated = await prisma.homepageSection.findUnique({
      where: { id },
    })

    return NextResponse.json({
      services: (updated?.settings as any)?.serviceIds || [],
    })
  } catch (error) {
    console.error('Error adding services to section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/homepage-sections/[id]/services - Remove a service from a section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = requireSuperAdmin()
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const prisma = getPrisma()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      return NextResponse.json(
        { error: 'serviceId query parameter is required' },
        { status: 400 }
      )
    }

    const section = await prisma.homepageSection.findUnique({
      where: { id },
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    const settings = (section.settings || {}) as Record<string, any>
    const existingServiceIds = settings.serviceIds || []
    const updatedServiceIds = existingServiceIds.filter(
      (id: string) => id !== serviceId
    )

    await prisma.homepageSection.update({
      where: { id },
      data: {
        settings: {
          ...settings,
          serviceIds: updatedServiceIds,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing service from section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}