import type { Metadata, Viewport } from 'next'
import { getPrisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import ProductClient from './product-client'
import { ProductJsonLd } from '@/components/seo/ProductJsonLd'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreammarket.png`

interface ProductForMetadata {
  id: string
  slug: string | null
  name: string | null
  description: string | null
  price: number
  stock: number
  availabilityType: string | null
  images: Array<{ url: string; alt: string | null }> | null
  store: { id: string; name: string; slug: string | null; logo: string | null } | null
  brandRelation: { name: string } | null
  averageRating: number
  reviewCount: number
}

async function getProductInfo(idOrSlug: string): Promise<ProductForMetadata | null> {
  try {
    const product = await getPrisma().product.findUnique({
      where: { slug: idOrSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        availabilityType: true,
        averageRating: true,
        reviewCount: true,
        images: { select: { url: true, alt: true } },
        store: { select: { id: true, name: true, slug: true, logo: true } },
        brandRelation: { select: { name: true } },
      },
    })

    if (product) {
      return {
        id: product.id,
        slug: product.slug,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        availabilityType: product.availabilityType,
        images: product.images,
        store: product.store,
        brandRelation: product.brandRelation,
        averageRating: product.averageRating ?? 0,
        reviewCount: product.reviewCount ?? 0,
      }
    }

    const productById = await getPrisma().product.findUnique({
      where: { id: idOrSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        availabilityType: true,
        averageRating: true,
        reviewCount: true,
        images: { select: { url: true, alt: true } },
        store: { select: { id: true, name: true, slug: true, logo: true } },
        brandRelation: { select: { name: true } },
      },
    })

    if (productById) {
      redirect(`/marketplace/product/${productById.slug}`)
    }

    return null
  } catch {
    return null
  }
}

function truncateDescription(description: string | null, maxChars: number = 160): string {
  if (!description) return 'Discover quality products from verified Ghanaian vendors on Dhream Market.'
  return description.length > maxChars ? description.substring(0, maxChars).trim() + '...' : description
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await getProductInfo(params.id)

  const title = product?.name ?? 'Product - Dhream Market'
  const description = truncateDescription(product?.description ?? null)

  const imageUrl = product?.images?.[0]?.url ?? product?.store?.logo ?? DEFAULT_OG_IMAGE
  const url = `${SITE_URL}/marketplace/product/${product?.slug ?? params.id}`

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
      images: imageUrl ? [{ url: imageUrl, width: 1200, height: 630, alt: product?.name ?? 'Product' }] : undefined,
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

  if (!product) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: 'Product Not Found',
            }),
          }}
        />
        <ProductClient />
      </>
    )
  }

  const productForJsonLd = {
    ...product,
    images: (product.images ?? []).map((img, i) => ({ ...img, id: String(i) })),
  }

  return (
    <>
      <ProductJsonLd product={productForJsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: 'Marketplace', url: '/marketplace' },
          { name: product?.name ?? 'Product', url: `/marketplace/product/${product?.slug ?? product?.id}` },
        ]}
      />
      <ProductClient />
    </>
  )
}