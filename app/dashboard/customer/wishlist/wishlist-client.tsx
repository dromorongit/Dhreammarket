'use client'

import Image from 'next/image'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { event } from '@/lib/gtag'
import { logCartRequest } from '@/lib/CartContext'
import { getBlurDataURL, CARD_IMAGE_SIZES_4COL } from '@/lib/image-utils'
import { ProductStockIndicator } from '@/components/ProductStockIndicator'

interface WishlistItem {
  id: string
  product: {
    id: string
    name: string
    slug: string | null
    price: number
    salesPrice: number | null
    dealsPrice: number | null
    availabilityType: string
    stock?: number | null
    images: Array<{
      id: string
      url: string
      alt: string | null
    }>
    store: {
      name: string
    } | null
  }
}

interface Wishlist {
  id: string
  items: WishlistItem[]
}

export default function WishlistClient() {
  const [wishlist, setWishlist] = useState<Wishlist | null>(null)
  const [loading, setLoading] = useState(true)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)

  const fetchWishlist = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/wishlist')
      if (response.ok) {
        const data = await response.json()
        setWishlist(data.wishlist)
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  const removeItem = async (productId: string) => {
    if (!wishlist) return

    const itemToRemove = wishlist.items.find(item => item.product.id === productId)
    if (!itemToRemove) return

    setRemovingItemId(itemToRemove.id)

    try {
      const response = await fetch(`/api/wishlist/${productId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setWishlist(prev => ({
          ...prev!,
          items: prev!.items.filter(item => item.product.id !== productId),
        }))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wishlist-updated'))
        }
      }
    } catch (error) {
      console.error('Error removing item:', error)
    } finally {
      setRemovingItemId(null)
    }
  }

  const addToCart = async (productId: string, productName?: string, productPrice?: number) => {
    try {
      logCartRequest('POST /api/cart (wishlist addToCart)')
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, quantity: 1 }),
      })

      if (response.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
        return
      }

      if (response.ok) {
        alert('Product added to cart!')
        if (productName !== undefined && productPrice !== undefined) {
          event({ action: 'add_to_cart', category: 'ecommerce', label: productName, value: productPrice })
        }
      } else {
        const error = await response.json()
        alert(error.error ?? 'Failed to add to cart')
      }
    } catch {
      alert('Error adding to cart')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!wishlist || wishlist.items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <EmptyState
            icon={
              <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364-1.5 1.5 0 00-.752.752L12 21l-1.936-4.182a1.5 1.5 0 00-.752-.752z" />
              </svg>
            }
            title="Your wishlist is empty"
            description="Browse the marketplace to find products you love"
            actionLabel="Browse Marketplace"
            actionHref="/marketplace"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-deep-navy mb-2">Your Wishlist</h1>
          <p className="text-slate-600">{wishlist.items.length} items saved</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlist.items.map((item) => {
            const { product } = item
            const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.price
            const hasDiscount = !!product.dealsPrice || !!product.salesPrice

            return (
              <Card
                key={product.id}
                variant="elevated"
                className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    {product.images?.[0] ? (
                      <Image
                        src={getOptimizedCloudinaryUrl(product.images[0].url, 400)}
                        alt={product.images[0].alt || product.name}
                        className="object-cover"
                        fill
                        loading="lazy"
                        sizes={CARD_IMAGE_SIZES_4COL}
                        placeholder="blur"
                        blurDataURL={getBlurDataURL()}
                       unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-100">
                        <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>

                <CardContent className="p-4 flex-1 flex flex-col">
                  <h3 className="text-sm font-semibold text-deep-navy line-clamp-2 mb-2">
                    {product.name}
                  </h3>

                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-royal-blue">
                      {formatPrice(effectivePrice)}
                    </span>
                    {hasDiscount && (
                      <span className="text-xs text-slate-400 line-through">
                        {formatPrice(product.price)}
                      </span>
                    )}
                  </div>

                  {product.store && (
                    <p className="text-xs text-slate-500 mb-3">{product.store.name}</p>
                  )}

                  <div className="mt-auto space-y-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => addToCart(product.id, product.name, product.price)}
                    >
                      Add to Cart
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => removeItem(product.id)}
                      disabled={removingItemId === item.id}
                    >
                      {removingItemId === item.id ? 'Removing...' : 'Remove'}
                    </Button>
                  </div>
                  <ProductStockIndicator stock={product.stock} availabilityType={product.availabilityType} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}