'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges'
import { MdVerified } from 'react-icons/md'
import { dispatchCartUpdate, handleAuthRedirect } from '@/lib/CartContext'

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreammarket.png`

interface ProductImage {
  id: string
  url: string
  alt: string | null
}

interface ProductVariant {
  id: string
  color: string | null
  size: string | null
  age: string | null
  sku: string | null
  stock: number
  active: boolean
}

interface ProductData {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  reservedQuantity: number
  availabilityType: string | null
  expectedArrivalDate: string | null
  expectedRestockDate: string | null
  preOrderNotes: string | null
  backOrderNotes: string | null
  category: {
    id: string
    name: string
  } | null
  store: {
    id: string
    name: string
    isVerified: boolean
    badgeTier: string | null
    logo: string | null
  } | null
  brandRelation: {
    id: string
    name: string
    slug: string
    logo: string | null
  } | null
  brand: string | null
  images: ProductImage[]
  variants: ProductVariant[]
  averageRating: number
  reviewCount: number
}

interface User {
  id: string
  role: string
}

function getAvailabilityStatus(availabilityType: string | null, stock: number): string {
  if (availabilityType === 'PREORDER' || availabilityType === 'BACKORDER') {
    return 'https://schema.org/PreOrder'
  }
  return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

export default function ProductPage() {
  const params = useParams()
  const productId = params.id as string

  const [product, setProduct] = useState<ProductData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)

useEffect(() => {
     if (!productId) return

     const fetchProduct = async () => {
       try {
         setLoading(true)
         const response = await fetch(`/api/products/${productId}`)
         if (response.ok) {
           const data = await response.json()
           setProduct(data.product)
           if (data.product?.images?.length > 0) {
             setSelectedImage(data.product.images[0].url)
           }
           if (data.product?.variants?.length > 0) {
             const activeVariant = data.product.variants.find((v: ProductVariant) => v.active)
             setSelectedVariant(activeVariant || data.product.variants[0])
           }
         } else {
           const errorData = await response.json()
           setError(errorData.error || 'Failed to load product')
         }
       } catch (err) {
         setError('Failed to load product')
         console.error(err)
       } finally {
         setLoading(false)
       }
     }

     fetchProduct()
   }, [productId])

  const addToCart = async () => {
    if (!product) return

    setAddingToCart(true)
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
          productVariantId: selectedVariant?.id,
        }),
      })

      if (response.status === 401) {
        handleAuthRedirect()
        return
      }

      if (response.ok) {
        dispatchCartUpdate()
        alert('Product added to cart!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add to cart')
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
      alert('Error adding to cart')
    } finally {
      setAddingToCart(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-10 w-1/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            title="Product Not Found"
            description={error || "The product you're looking for doesn't exist."}
            actionLabel="Back to Marketplace"
            onAction={() => window.location.href = '/marketplace'}
          />
        </div>
      </div>
    )
  }

  const effectivePrice = product.price
  const availableStock = product.stock - product.reservedQuantity

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.name}
                className="w-full aspect-square object-cover rounded-lg"
              />
            ) : (
              <div className="w-full aspect-square bg-slate-100 rounded-lg flex items-center justify-center">
                <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}

            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 mt-4">
                {product.images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.url)}
                    className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${selectedImage === img.url ? 'border-royal-blue' : 'border-slate-200'
                      }`}
                  >
                    <img
                      src={img.url}
                      alt={img.alt || product.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-deep-navy mb-4">{product.name}</h1>

            <div className="flex items-center gap-2 mb-4">
              {product.store && (
                <Link href={`/vendor/${product.store.id}`} className="text-slate-600 hover:text-royal-blue">
                  {truncateVendorName(product.store.name)}
                </Link>
              )}
              {(() => {
                if (!product.store) return null
                const badgeInfo = getVendorBadgeInfo(product.store.badgeTier)
                if (badgeInfo) {
                  const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                  return <MdVerified className={`w-4 h-4 ${iconColor}`} />
                }
                if (product.store.isVerified) {
                  return <MdVerified className="w-4 h-4 text-sky-500" />
                }
                return null
              })()}
            </div>

            <div className="text-3xl font-bold text-royal-blue mb-6">{formatPrice(effectivePrice)}</div>

            <ProductBadges product={calculateProductBadges({
              price: product.price,
              stock: product.stock,
              availabilityType: product.availabilityType,
              expectedArrivalDate: product.expectedArrivalDate,
              expectedRestockDate: product.expectedRestockDate,
            })} />

            {product.description && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-deep-navy mb-2">Description</h2>
                <p className="text-slate-600">{product.description}</p>
              </div>
            )}

            <div className="mt-6">
              <Button
                onClick={addToCart}
                disabled={addingToCart || availableStock === 0}
                className="w-full sm:w-auto"
              >
                {addingToCart
                  ? 'Adding...'
                  : availableStock === 0 && product.availabilityType === 'IN_STOCK'
                    ? 'Out of Stock'
                    : product.availabilityType === 'PREORDER'
                      ? 'Pre-order Now'
                      : product.availabilityType === 'BACKORDER'
                        ? 'Backorder'
                        : 'Add to Cart'}
              </Button>
            </div>

            {product.variants && product.variants.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Variants</h3>
                <select
                  value={selectedVariant?.id || ''}
                  onChange={(e) => {
                    const v = product.variants.find(v => v.id === e.target.value)
                    setSelectedVariant(v || null)
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-2"
                >
                  {product.variants.map((variant) => (
                    <option key={variant.id} value={variant.id} disabled={!variant.active}>
                      {variant.color && `Color: ${variant.color}`}
                      {variant.size && ` / Size: ${variant.size}`}
                      {variant.age && ` / Age: ${variant.age}`}
                      {!variant.active && ' (Out of Stock)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}