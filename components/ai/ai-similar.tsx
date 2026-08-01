'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { getBlurDataURL, CARD_IMAGE_SIZES } from '@/lib/image-utils'
import Image from 'next/image'

interface AISimilarItem {
  id: string
  name?: string
  title?: string
  slug: string
  price?: number
  salesPrice?: number | null
  dealsPrice?: number | null
  startingPrice?: number
  thumbnail?: string | null
  image?: string | null
  store?: { name: string; slug: string } | null
  category?: { name: string } | null
  reason: string
  type: string
  score: number
}

interface AISimilarProps {
  entityId: string
  entityType: string
  title?: string
  limit?: number
}

function AISimilarCard({ item }: { item: AISimilarItem }) {
  const isProduct = item.type === 'PRODUCT'
  const name = item.name || item.title || 'Unknown'
  const price = item.dealsPrice || item.salesPrice || item.price || item.startingPrice || 0

  return (
    <Card variant="elevated" className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300">
      <Link href={isProduct ? `/marketplace/product/${item.slug}` : `/services/${item.slug}`}>
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {item.image ? (
            <Image src={item.image} alt={name} className="object-cover" fill loading="lazy" sizes={CARD_IMAGE_SIZES} placeholder="blur" blurDataURL={getBlurDataURL()} />
          ) : item.thumbnail ? (
            <Image src={item.thumbnail} alt={name} className="object-cover" fill loading="lazy" sizes={CARD_IMAGE_SIZES} placeholder="blur" blurDataURL={getBlurDataURL()} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
      </Link>
      <div className="p-4 flex-1 flex flex-col">
        <Link href={isProduct ? `/marketplace/product/${item.slug}` : `/services/${item.slug}`}>
          <h3 className="text-sm font-semibold text-deep-navy line-clamp-2 mb-2">{name}</h3>
        </Link>
        {item.store && (
          <p className="text-xs text-slate-500 mb-2">{item.store.name}</p>
        )}
        <div className="mt-auto">
          <span className="text-lg font-bold text-royal-blue">${price.toFixed(2)}</span>
          <p className="text-xs text-gray-400 mt-1">{item.reason}</p>
        </div>
      </div>
    </Card>
  )
}

export function AISimilar({ entityId, entityType, title, limit }: AISimilarProps) {
  const [items, setItems] = useState<AISimilarItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSimilar = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('entityId', entityId)
      params.set('entityType', entityType)
      params.set('limit', String(limit ?? 8))

      const response = await fetch(`/api/ai/similar?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.similar ?? [])
      }
    } catch (error) {
      console.error('Error fetching AI similar items:', error)
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType, limit])

  useEffect(() => {
    fetchSimilar()
  }, [fetchSimilar])

  if (loading) {
    return (
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(limit ?? 8)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-deep-navy mb-6">{title ?? 'Similar Items'}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <AISimilarCard key={`${item.type}_${item.id}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}