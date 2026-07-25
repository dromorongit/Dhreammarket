import type { FC } from 'react'

interface ProductImage {
  id: string
  url: string
  alt: string | null
}

interface ProductStore {
  id: string
  slug: string | null
  name: string
  logo: string | null
}

interface ProductForJsonLd {
  id: string
  name: string | null
  description: string | null
  price: number
  stock: number
  availabilityType: string | null
  images: ProductImage[] | null
  store: ProductStore | null
  brandRelation: { name: string } | null
  averageRating: number
  reviewCount: number
}

const SITE_URL = 'https://www.dhreamarket.com'

function getAvailabilityStatus(availabilityType: string | null, stock: number): string {
  if (availabilityType === 'PREORDER' || availabilityType === 'BACKORDER') {
    return 'https://schema.org/PreOrder'
  }
  return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

interface ProductJsonLdProps {
  product: ProductForJsonLd
}

export const ProductJsonLd: FC<ProductJsonLdProps> = ({ product }) => {
  const productImages = product.images?.map((img) => img.url) ?? []
  const availability = getAvailabilityStatus(product.availabilityType ?? null, product.stock)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name ?? 'Product',
    description: product.description ?? undefined,
    image: productImages.length > 0 ? productImages : undefined,
    offers: {
      '@type': 'Offer',
      price: product.price ?? 0,
      priceCurrency: 'GHS',
      availability,
      url: `${SITE_URL}/marketplace/product/${product.id}`,
      seller: product.store?.name ? {
        '@type': 'Organization',
        name: product.store.name,
        url: `${SITE_URL}/vendor/${product.store.slug ?? product.store.id}`,
      } : undefined,
    },
    brand: product.brandRelation?.name ? {
      '@type': 'Brand',
      name: product.brandRelation.name,
    } : undefined,
  }

  if (product.averageRating > 0 && product.reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.averageRating,
      reviewCount: product.reviewCount,
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}