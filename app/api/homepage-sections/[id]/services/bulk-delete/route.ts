import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

// POST bulk remove services from a section
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

    const settings = (section.settings || {}) as Record<string, any>
    const existingServiceIds = settings.serviceIds || []
    const updatedServiceIds = existingServiceIds.filter(
      (sid: string) => !serviceIds.includes(sid)
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

    return NextResponse.json({
      success: true,
      removed: serviceIds.length,
      serviceIds: updatedServiceIds,
    })
  } catch (error) {
    console.error('Error bulk removing services from section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}