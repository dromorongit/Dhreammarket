import { Metadata, Viewport } from 'next'
import { getPrisma } from '@/lib/prisma'
import VendorClient from './vendor-client'

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreamarket.png`

async function getVendorInfo(idOrSlug: string): Promise<any | null> {
  try {
    let store = await getPrisma().store.findUnique({
      where: { slug: idOrSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        logo: true,
        banner: true,
        categoryId: true,
        badgeTier: true,
        averageRating: true,
        reviewCount: true,
      },
    })
    if (store && store.categoryId) return store

    store = await getPrisma().store.findUnique({
      where: { id: idOrSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        logo: true,
        banner: true,
        categoryId: true,
        badgeTier: true,
        averageRating: true,
        reviewCount: true,
      },
    })
    return store
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const vendor = await getVendorInfo(params.id)
  if (!vendor) return { title: 'Vendor - Dhream Market' }

  const title = `${vendor.name} - Dhream Market`
  const description = vendor.description || `Shop products and services from ${vendor.name} on Dhream Market.`
  const imageUrl = vendor.logo || vendor.banner || DEFAULT_OG_IMAGE
  const url = `${SITE_URL}/vendor/${vendor.slug ?? vendor.id}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: vendor.name }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: imageUrl ? [imageUrl] : undefined },
  }
}

export function generateViewport(): Viewport {
  return { themeColor: '#1e40af' }
}

export default async function VendorPage({ params }: { params: { id: string } }) {
  const vendor = await getVendorInfo(params.id)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: vendor?.name || 'Dhream Market Vendor',
    description: vendor?.description || `Shop products and services from ${vendor?.name} on Dhream Market.`,
    url: `${SITE_URL}/vendor/${vendor?.slug ?? vendor?.id}`,
    logo: vendor?.logo || DEFAULT_OG_IMAGE,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <VendorClient />
    </>
  )
}