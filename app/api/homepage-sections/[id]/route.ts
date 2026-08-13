import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/adminAuth";

// GET /api/homepage-sections/[id] - Get a single section
export async function GET(
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

    const section = await prisma.homepageSection.findUnique({
      where: { id },
      include: {
        products: {
          orderBy: { displayOrder: "asc" },
          include: {
            product: {
              include: {
                images: true,
                category: true,
store: {
                   select: { id: true, name: true, isVerified: true, badgeTier: true },
                 },
              },
            },
          },
        },
vendors: {
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
                       badgeTier: true,
                       _count: { select: { products: true } },
                     },
                   },
                },
              },
            },
          },
        brands: {
          orderBy: { brand: { displayOrder: "asc" } },
          include: {
            brand: {
              include: {
                _count: {
                  select: { products: true },
                },
              },
            },
          },
        },
      },
    });

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({ section });
  } catch (error) {
    console.error("Error fetching homepage section:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PUT /api/homepage-sections/[id] - Update a section
export async function PUT(
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
    const { name, slug, type, subtitle, isEnabled, displayOrder, settings } =
      await request.json();

    const existing = await prisma.homepageSection.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Check slug uniqueness if changed
    if (slug && slug !== existing.slug) {
      const slugExists = await prisma.homepageSection.findUnique({
        where: { slug },
      });
      if (slugExists) {
        return NextResponse.json(
          { error: "A section with this slug already exists" },
          { status: 409 },
        );
      }
    }

    const section = await prisma.homepageSection.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        slug: slug ?? existing.slug,
        type: type ?? existing.type,
        subtitle: subtitle !== undefined ? subtitle : existing.subtitle,
        isEnabled: isEnabled ?? existing.isEnabled,
        displayOrder: displayOrder ?? existing.displayOrder,
        settings: settings !== undefined ? { ...(existing.settings as Record<string, any> || {}), ...settings } : existing.settings,
      },
    });

    return NextResponse.json({ section });
  } catch (error) {
    console.error("Error updating homepage section:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/homepage-sections/[id] - Delete a section
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

    const existing = await prisma.homepageSection.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    await prisma.homepageSection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting homepage section:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
