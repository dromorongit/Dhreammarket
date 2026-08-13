import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/adminAuth";

// POST /api/homepage-sections/[id]/brands - Add brands to a section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    

    const prisma = getPrisma();
    const { id } = await params;
    const { brandIds } = await request.json();

    if (!brandIds || !Array.isArray(brandIds) || brandIds.length === 0) {
      return NextResponse.json(
        { error: "brandIds array is required" },
        { status: 400 },
      );
    }

    // Verify section exists
    const section = await prisma.homepageSection.findUnique({
      where: { id },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Verify all brands exist
    const brands = await prisma.brand.findMany({
      where: { id: { in: brandIds } },
    });

    if (brands.length !== brandIds.length) {
      return NextResponse.json(
        { error: "Some brands were not found" },
        { status: 404 },
      );
    }

    // Create associations (skip duplicates)
    const existing = await prisma.homepageSectionBrand.findMany({
      where: { sectionId: id },
      select: { brandId: true },
    });
    const existingIds = new Set(existing.map((e) => e.brandId));
    const newBrandIds = brandIds.filter((bid: string) => !existingIds.has(bid));

    if (newBrandIds.length > 0) {
      await prisma.homepageSectionBrand.createMany({
        data: newBrandIds.map((brandId: string) => ({
          sectionId: id,
          brandId,
        })),
        skipDuplicates: true,
      });
    }

    const updated = await prisma.homepageSectionBrand.findMany({
      where: { sectionId: id },
      include: {
        brand: {
          include: {
            _count: {
              select: { products: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ brands: updated });
  } catch (error) {
    console.error("Error adding brands to section:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/homepage-sections/[id]/brands - Remove a brand from a section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireSuperAdmin();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const prisma = getPrisma();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");

    if (!brandId) {
      return NextResponse.json(
        { error: "brandId query parameter is required" },
        { status: 400 },
      );
    }

    await prisma.homepageSectionBrand.deleteMany({
      where: { sectionId: id, brandId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing brand from section:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
