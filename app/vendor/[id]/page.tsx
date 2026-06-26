import type { Metadata, Viewport } from 'next'
import { getPrisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import VendorClient from './vendor-client'

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreammarket.png`

interface VendorForMetadata {
  id: string
  slug: string | null
  name: string | null
  description: string | null
  logo: string | null
  banner: string | null
}

async function getVendorInfo(idOrSlug: string): Promise<VendorForMetadata | null> {
  try {
    const store = await getPrisma().store.findUnique({
      where: { slug: idOrSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logo: true,
        banner: true,
        categoryId: true,
      },
    })

    if (store && store.categoryId) {
      return {
        id: store.id,
        slug: store.slug,
        name: store.name,
        description: store.description,
        logo: store.logo,
        banner: store.banner,
      }
    }

    const storeById = await getPrisma().store.findUnique({
      where: { id: idOrSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        logo: true,
        banner: true,
        categoryId: true,
      },
    })

    if (storeById && storeById.categoryId) {
      return {
        id: storeById.id,
        slug: storeById.slug,
        name: storeById.name,
        description: storeById.description,
        logo: storeById.logo,
        banner: storeById.banner,
      }
    }

    return null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const vendor = await getVendorInfo(params.id)

  const title = vendor?.name ? `${vendor.name} - Dhream Market` : 'Dhream Market - Powering Digital Trade'
  const description = vendor?.description || (vendor?.name ? `Shop products from ${vendor.name} on Dhream Market.` : 'Discover amazing products from verified vendors on Dhream Market.')

  const imageUrl = vendor?.logo || vendor?.banner || DEFAULT_OG_IMAGE
  const url = `${SITE_URL}/vendor/${vendor?.slug ?? params.id}`

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: vendor?.name || 'Vendor store' }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  }
}

export function generateViewport(): Viewport {
  return {
    themeColor: '#1e40af',
  }
}



export default async function VendorPage({ params }: { params: { id: string } }) {
  const vendor = await getVendorInfo(params.id)

  // Check if this was accessed by ID (old CUID URL) and should redirect to slug
  if (!vendor) {
    const storeById = await getPrisma().store.findUnique({
      where: { id: params.id },
      select: { slug: true },
    })
    if (storeById?.slug) {
      redirect(`/vendor/${storeById.slug}`)
    }
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Vendor Not Found',
            }),
          }}
        />
        <VendorClient />
      </>
    )
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: vendor?.name || 'Dhream Market Vendor',
    description: vendor?.description || `Shop products from ${vendor?.name} on Dhream Market.`,
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