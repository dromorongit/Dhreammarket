import type { Metadata } from 'next'
import { getPrisma } from '@/lib/prisma'
import VendorClient from './vendor-client'

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreammarket.png`

interface VendorForMetadata {
  id: string
  name: string | null
  description: string | null
  logo: string | null
  banner: string | null
}

async function getVendorInfo(id: string): Promise<VendorForMetadata | null> {
  try {
    const store = await getPrisma().store.findUnique({
      where: { id: id },
    })

    if (!store || !store.categoryId) return null

    return {
      id: store.id,
      name: store.name,
      description: store.description,
      logo: store.logo,
      banner: store.banner,
    }
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const vendor = await getVendorInfo(params.id)

  const title = vendor?.name ? `${vendor.name} - Dhream Market` : 'Dhream Market - Powering Digital Trade'
  const description = vendor?.description || (vendor?.name ? `Shop products from ${vendor.name} on Dhream Market.` : 'Discover amazing products from verified vendors on Dhream Market.')

  const imageUrl = vendor?.logo || vendor?.banner || DEFAULT_OG_IMAGE
  const url = `${SITE_URL}/vendor/${params.id}`

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

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: vendor?.name || 'Dhream Market Vendor',
    description: vendor?.description || `Shop products from ${vendor?.name} on Dhream Market.`,
    url: `${SITE_URL}/vendor/${params.id}`,
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