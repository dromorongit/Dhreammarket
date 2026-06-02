import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

// POST /api/homepage-sections/[id]/vendors - Add vendors to a section
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
    const { vendorIds } = await request.json()

    if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length === 0) {
      return NextResponse.json(
        { error: 'vendorIds array is required' },
        { status: 400 }
      )
    }

    // Verify section exists
    const section = await prisma.homepageSection.findUnique({
      where: { id },
    })

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    // Verify all vendors exist
    const vendors = await prisma.user.findMany({
      where: { id: { in: vendorIds } },
      include: {
        profile: true,
        store: { select: { id: true, name: true, isVerified: true, isFeatured: true } },
      },
    })

    if (vendors.length !== vendorIds.length) {
      return NextResponse.json(
        { error: 'Some vendors were not found' },
        { status: 404 }
      )
    }

    // Create associations (skip duplicates)
    const existing = await prisma.homepageSectionVendor.findMany({
      where: { sectionId: id },
      select: { vendorId: true },
    })
    const existingIds = new Set(existing.map((e) => e.vendorId))
    const newVendorIds = vendorIds.filter((vid: string) => !existingIds.has(vid))

    if (newVendorIds.length > 0) {
      await prisma.homepageSectionVendor.createMany({
        data: newVendorIds.map((vendorId: string) => ({
          sectionId: id,
          vendorId,
        })),
        skipDuplicates: true,
      })
    }

    const updated = await prisma.homepageSectionVendor.findMany({
      where: { sectionId: id },
      include: {
        vendor: {
          include: {
            profile: true,
            store: {
              select: {
                id: true,
                name: true,
                isVerified: true,
                isFeatured: true,
                logo: true,
                _count: { select: { products: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      vendors: updated.map((v) => ({
        ...v.vendor,
        storeName: v.vendor.store?.name ?? v.vendor.profile?.firstName ?? '',
        productCount: v.vendor.store?._count?.products ?? 0,
      })),
    })
  } catch (error) {
    console.error('Error adding vendors to section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/homepage-sections/[id]/vendors - Remove a vendor from a section
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
    const vendorId = searchParams.get('vendorId')

    if (!vendorId) {
      return NextResponse.json(
        { error: 'vendorId query parameter is required' },
        { status: 400 }
      )
    }

    await prisma.homepageSectionVendor.deleteMany({
      where: { sectionId: id, vendorId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing vendor from section:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}