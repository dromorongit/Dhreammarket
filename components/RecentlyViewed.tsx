'use client'

import Image from 'next/image'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from './Card'
import { Button } from './Button'
import { Skeleton } from './Skeleton'
import { getBlurDataURL, CARD_IMAGE_SIZES_4COL } from '@/lib/image-utils'
import { ProductStockIndicator } from '@/components/ProductStockIndicator'

interface RecentlyViewedItem {
  entityType: string
  entityId: string
  product?: {
    id: string
    name: string
    slug: string
    price: number
    salesPrice?: number | null
    dealsPrice?: number | null
    image?: string | null
    stock?: number | null
    availabilityType?: string | null
    store?: { name: string } | null
  }
  service?: {
    id: string
    title: string
    slug: string
    startingPrice: number
    thumbnail?: string | null
    store?: { name: string } | null
  }
}

export function RecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentlyViewed()
  }, [])

  const fetchRecentlyViewed = async () => {
    try {
      const response = await fetch('/api/recently-viewed?limit=10')
      if (response.ok) {
        const data = await response.json()
        setItems(data.recentlyViewed || [])
      }
    } catch (error) {
      console.error('Error fetching recently viewed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-deep-navy">Recently Viewed</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => {
          const product = item.product
          const service = item.service
          const isProduct = !!product

          return (
            <Link key={`${item.entityType}_${item.entityId}`} href={isProduct ? `/marketplace/product/${product?.slug}` : `/services/${service?.slug}`}>
              <Card variant="elevated" className="group flex flex-col overflow-hidden">
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                  {isProduct && product?.image ? (
                    <Image src={getOptimizedCloudinaryUrl(product.image, 400)} alt={product.name} className="object-cover" fill loading="lazy" sizes={CARD_IMAGE_SIZES_4COL} placeholder="blur" blurDataURL={getBlurDataURL()}  unoptimized />
                  ) : !isProduct && service?.thumbnail ? (
                    <Image src={getOptimizedCloudinaryUrl(service.thumbnail, 400)} alt={service.title} className="object-cover" fill loading="lazy" sizes={CARD_IMAGE_SIZES_4COL} placeholder="blur" blurDataURL={getBlurDataURL()}  unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100">
                      <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-deep-navy line-clamp-2">
                    {isProduct ? product?.name : service?.title}
                  </h3>
                  {isProduct && product?.store && (
                    <p className="text-xs text-slate-500 mt-1">{product.store.name}</p>
                  )}
                  {isProduct && (
                    <ProductStockIndicator stock={product?.stock} availabilityType={product?.availabilityType} />
                  )}
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}