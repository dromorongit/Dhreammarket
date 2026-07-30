import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function GET(request: NextRequest, { params }: { params: { entityType: string; entityId: string } }) {
  try {
    const { entityType, entityId } = params

    const seo = await getPrisma().seoMetadata.findUnique({
      where: { entityType_entityId: { entityType, entityId } },
    })

    if (!seo) {
      return NextResponse.json({ seo: null })
    }

    return NextResponse.json({
      seo: {
        metaTitle: seo.metaTitle,
        metaDescription: seo.metaDescription,
        canonicalUrl: seo.canonicalUrl,
        ogTitle: seo.ogTitle,
        ogDescription: seo.ogDescription,
        ogImage: seo.ogImage,
        twitterTitle: seo.twitterTitle,
        twitterDescription: seo.twitterDescription,
        twitterImage: seo.twitterImage,
        jsonLd: seo.jsonLd,
      },
    })
  } catch (error) {
    console.error('Error fetching SEO metadata:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { entityType: string; entityId: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { entityType, entityId } = params
    const { metaTitle, metaDescription, canonicalUrl, ogTitle, ogDescription, ogImage, twitterTitle, twitterDescription, twitterImage, jsonLd } = await request.json()

    const seo = await getPrisma().seoMetadata.upsert({
      where: { entityType_entityId: { entityType, entityId } },
      update: {
        metaTitle, metaDescription, canonicalUrl,
        ogTitle, ogDescription, ogImage,
        twitterTitle, twitterDescription, twitterImage, jsonLd,
      },
      create: {
        entityType, entityId,
        metaTitle, metaDescription, canonicalUrl,
        ogTitle, ogDescription, ogImage,
        twitterTitle, twitterDescription, twitterImage, jsonLd,
      },
    })

    return NextResponse.json({ seo })
  } catch (error) {
    console.error('Error saving SEO metadata:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}