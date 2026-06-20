import type { Metadata, Viewport } from 'next'
import { getPrisma } from '@/lib/prisma'
import ProductClient from './product-client'

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreammarket.png`

interface ProductForMetadata {
  id: string
  name: string | null
  description: string | null
  price: number
  stock: number
  availabilityType: string | null
  images: Array<{ url: string; alt: string | null }> | null
  store: { id: string; name: string; logo: string | null } | null
  brandRelation: { name: string } | null
}

async function getProductInfo(id: string): Promise<ProductForMetadata | null> {
  try {
    const product = await getPrisma().product.findUnique({
      where: { id: id },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        availabilityType: true,
        images: { select: { url: true, alt: true } },
        store: { select: { id: true, name: true, logo: true } },
        brandRelation: { select: { name: true } },
      },
    })

    if (!product) return null

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      availabilityType: product.availabilityType,
      images: product.images,
      store: product.store,
      brandRelation: product.brandRelation,
    }
  } catch {
    return null
  }
}

function getAvailabilityStatus(availabilityType: string | null, stock: number): string {
  if (availabilityType === 'PREORDER' || availabilityType === 'BACKORDER') {
    return 'https://schema.org/PreOrder'
  }
  return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await getProductInfo(params.id)

  const title = product?.name ? `${product.name} - Dhream Market` : 'Dhream Market - Powering Digital Trade'
  const description = product?.description || (product?.store?.name && product?.name ? `Buy ${product.name} from ${product.store.name} on Dhream Market.` : 'Discover quality products on Dhream Market.')

  const imageUrl = product?.images?.[0]?.url ||
    product?.store?.logo ||
    DEFAULT_OG_IMAGE

  const url = `${SITE_URL}/marketplace/product/${params.id}`

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
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: product?.name || 'Product' }] : undefined,
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

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductInfo(params.id)

  const productImages = product?.images?.map((img) => img.url) || [DEFAULT_OG_IMAGE]
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product?.name || 'Product',
    description: product?.description || `Buy ${product?.name} from ${product?.store?.name} on Dhream Market.`,
    image: productImages,
    brand: product?.brandRelation?.name ? { '@type': 'Brand', name: product.brandRelation.name } : undefined,
    offers: {
      '@type': 'Offer',
      price: product?.price?.toString() || '0',
      priceCurrency: 'GHS',
      availability: getAvailabilityStatus(product?.availabilityType ?? null, product?.stock ?? 0),
      seller: product?.store?.name ? { '@type': 'Organization', name: product.store.name } : undefined,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ProductClient />
    </>
  )
}