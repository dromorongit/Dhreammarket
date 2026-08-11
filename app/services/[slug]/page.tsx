import { Metadata, Viewport } from 'next'
import { getPrisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ServiceDetailClient from './service-detail-client'

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreamarket.png`

interface ServiceForMetadata {
  id: string
  slug: string | null
  title: string | null
  description: string | null
  startingPrice: number
  pricingType: string
  estimatedDeliveryTime: string | null
  thumbnail: string | null
  gallery: string[]
  store: { id: string; name: string; slug: string | null; logo: string | null; averageRating: number; reviewCount: number } | null
  category: { id: string; name: string; slug: string } | null
  vendorServices: Array<{ id: string; slug: string; title: string; startingPrice: number; pricingType: string; thumbnail: string | null; store: { id: string; name: string; slug: string | null; isVerified: boolean; badgeTier: string | null } }>
  relatedServices: Array<{ id: string; slug: string; title: string; startingPrice: number; pricingType: string; thumbnail: string | null; store: { id: string; name: string; slug: string | null; isVerified: boolean; badgeTier: string | null } }>
}

async function getServiceInfo(idOrSlug: string): Promise<ServiceForMetadata | null> {
  try {
    const service = await getPrisma().service.findUnique({
      where: { slug: idOrSlug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        startingPrice: true,
        pricingType: true,
        estimatedDeliveryTime: true,
        thumbnail: true,
        gallery: true,
        store: { select: { id: true, name: true, slug: true, logo: true, averageRating: true, reviewCount: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    })

    let vendorServices: ServiceForMetadata['vendorServices'] = []
    let relatedServices: ServiceForMetadata['relatedServices'] = []

    if (service) {
      if (service.store?.id) {
        const rawVendorServices = await getPrisma().service.findMany({
          where: {
            store: { id: service.store.id },
            id: { not: service.id },
          },
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            slug: true,
            title: true,
            startingPrice: true,
            pricingType: true,
            thumbnail: true,
            store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true } },
          },
        })
        vendorServices = rawVendorServices.map((s) => ({
          id: s.id,
          slug: s.slug,
          title: s.title,
          startingPrice: Number(s.startingPrice),
          pricingType: s.pricingType,
          thumbnail: s.thumbnail,
          store: s.store ? { id: s.store.id, name: s.store.name, slug: s.store.slug, isVerified: s.store.isVerified, badgeTier: s.store.badgeTier } : { id: '', name: '', slug: null, isVerified: false, badgeTier: null },
        }))
      }

      if (service.category?.id) {
        const rawCategoryServices = await getPrisma().service.findMany({
          where: {
            category: { id: service.category.id },
            id: { not: service.id },
          },
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            slug: true,
            title: true,
            startingPrice: true,
            pricingType: true,
            thumbnail: true,
            store: { select: { id: true, name: true, slug: true, isVerified: true, badgeTier: true } },
          },
        })
        const vendorServiceIds = new Set(vendorServices.map((s) => s.id))
        relatedServices = rawCategoryServices
          .filter((s) => !vendorServiceIds.has(s.id))
          .map((s) => ({
            id: s.id,
            slug: s.slug,
            title: s.title,
            startingPrice: Number(s.startingPrice),
            pricingType: s.pricingType,
            thumbnail: s.thumbnail,
            store: s.store ? { id: s.store.id, name: s.store.name, slug: s.store.slug, isVerified: s.store.isVerified, badgeTier: s.store.badgeTier } : { id: '', name: '', slug: null, isVerified: false, badgeTier: null },
          }))
      }

      return {
        id: service.id,
        slug: service.slug,
        title: service.title,
        description: service.description,
        startingPrice: Number(service.startingPrice),
        pricingType: service.pricingType,
        estimatedDeliveryTime: service.estimatedDeliveryTime,
        thumbnail: service.thumbnail,
        gallery: service.gallery,
        store: service.store,
        category: service.category,
        vendorServices,
        relatedServices,
      }
    }

    const serviceById = await getPrisma().service.findUnique({
      where: { id: idOrSlug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        startingPrice: true,
        pricingType: true,
        estimatedDeliveryTime: true,
        thumbnail: true,
        gallery: true,
        store: { select: { id: true, name: true, slug: true, logo: true, averageRating: true, reviewCount: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    })

    if (serviceById) {
      redirect(`/services/${serviceById.slug}`)
    }

    return null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const service = await getServiceInfo(params.slug)

  const title = service?.title ?? 'Service - Dhream Market'
  const description = service?.description?.substring(0, 160) ?? 'Discover professional services from verified vendors on Dhream Market.'
  const imageUrl = service?.thumbnail ?? service?.store?.logo ?? DEFAULT_OG_IMAGE
  const url = `${SITE_URL}/services/${service?.slug ?? params.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: service?.title ?? 'Service' }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export default async function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const service = await getServiceInfo(params.slug)

  if (!service) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Service', name: 'Service Not Found' }),
          }}
        />
        <ServiceDetailClient serviceId={params.slug} vendorServices={[]} relatedServices={[]} />
      </>
    )
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service?.title ?? 'Dhream Market Service',
    description: service?.description ?? '',
    provider: {
      '@type': 'Organization',
      name: service?.store?.name ?? 'Dhream Market',
    },
    url: `${SITE_URL}/services/${service?.slug}`,
    image: service?.thumbnail ?? DEFAULT_OG_IMAGE,
    offers: {
      '@type': 'Offer',
      price: Number(service?.startingPrice ?? 0),
      priceCurrency: 'GHS',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ServiceDetailClient serviceId={service.id} vendorServices={service.vendorServices} relatedServices={service.relatedServices} />
    </>
  )
}

function ServiceDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-slate-200 rounded-2xl animate-pulse" style={{ aspectRatio: '16/9' }} />
          <div className="space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse" />
            <div className="h-10 bg-slate-200 rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
            <div className="h-24 bg-slate-200 rounded w-full animate-pulse" />
            <div className="h-12 bg-slate-200 rounded w-40 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}