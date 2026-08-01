'use client'

import { useState, useEffect, Suspense, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { getBlurDataURL, CARD_IMAGE_SIZES } from '@/lib/image-utils'
import Image from 'next/image'

interface AIRecommendationItem {
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

interface AIRecommendationsProps {
  title?: string
  subtitle?: string
  recommendationType?: string
  entityId?: string
  entityType?: string
  userId?: string
  limit?: number
  layout?: 'grid' | 'horizontal' | 'carousel'
}

function AIRecommendationCard({ item }: { item: AIRecommendationItem }) {
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
          <span className="text-lg font-bold text-royal-blue">{formatPrice(price)}</span>
          <p className="text-xs text-gray-400 mt-1">{item.reason}</p>
        </div>
      </div>
    </Card>
  )
}

function AIRecommendationsContent({ title, subtitle, recommendationType, entityId, entityType, userId, limit, layout }: AIRecommendationsProps) {
  const [items, setItems] = useState<AIRecommendationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecommendations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('type', recommendationType ?? 'RECOMMENDED_FOR_YOU')
      params.set('limit', String(limit ?? 10))
      if (entityId) params.set('entityId', entityId)
      if (entityType) params.set('entityType', entityType)

      const response = await fetch(`/api/ai/recommendations?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.recommendations ?? [])
      }
    } catch (error) {
      console.error('Error fetching AI recommendations:', error)
    } finally {
      setLoading(false)
    }
  }, [recommendationType, entityId, entityType, limit])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  if (loading) {
    if (layout === 'horizontal') {
      return (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
          {[...Array(limit ?? 4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-64">
              <SkeletonCard />
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className={`grid ${layout === 'carousel' ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-4`}>
        {[...Array(limit ?? 4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return null
  }

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-deep-navy">{title ?? 'Recommended for You'}</h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          <Link href={`/marketplace?sort=${recommendationType?.toLowerCase() ?? 'recommended'}`}>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
        <div className={`grid ${layout === 'horizontal' ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-4`}>
          {items.map((item) => (
            <AIRecommendationCard key={`${item.type}_${item.id}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function AIRecommendations(props: AIRecommendationsProps) {
  return (
    <Suspense fallback={<AIRecommendationsSkeleton {...props} />}>
      <AIRecommendationsContent {...props} />
    </Suspense>
  )
}

function AIRecommendationsSkeleton(props: AIRecommendationsProps) {
  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className={`grid ${props.layout === 'horizontal' ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'} gap-4`}>
          {[...Array(props.limit ?? 4)].map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </section>
  )
}