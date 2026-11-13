import { Metadata, Viewport } from 'next'
import { getPrisma } from '@/lib/prisma'
import { SITE_URL } from '@/lib/site-config'
import VendorClient from './vendor-client'
import { isTrustProfileEnabled } from '@/lib/feature-flags'
import { getCachedSellerTrustProfile } from '@/lib/trust/cached-profile'
import { composeProfile } from '@/lib/trust/metrics'
import { rehydrateProfileInput } from '@/lib/trust/rehydrate'

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

  let description = vendor.description || `Shop products and services from ${vendor.name} on Dhream Market.`

  if (isTrustProfileEnabled() && vendor?.id) {
    try {
      const cached = await getCachedSellerTrustProfile(vendor.id)
      if (cached.found) {
        const profile = composeProfile(rehydrateProfileInput(cached.data))
        const verified = profile.identity.status === 'VERIFIED' ? 'Verified seller' : 'Unverified seller'
        const ratingPart =
          profile.ratings.state === 'OK' && profile.ratings.value
            ? `${profile.ratings.value.average.toFixed(1)}★ (${profile.ratings.value.count} verified purchases)`
            : ''
        const parts = [vendor.name, verified, `${profile.orders.lifetimeCompleted} completed orders`, ratingPart].filter(Boolean)
        description = `${parts.join(' · ')}. ${vendor.description || `Shop products and services from ${vendor.name} on Dhream Market.`}`
      }
    } catch {
      // ignore
    }
  }

  const title = `${vendor.name} - Dhream Market`
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