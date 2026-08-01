'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import { Badge } from './Badge'
import { getBlurDataURL, CARD_IMAGE_SIZES } from '@/lib/image-utils'

interface RecommendationCardProps {
  item: {
    id: string
    name?: string
    title?: string
    slug: string
    price?: number
    salesPrice?: number | null
    dealsPrice?: number | null
    image?: string | null
    store?: { name: string } | null
    reason: string
    type: string
  }
}

export function RecommendationCard({ item }: RecommendationCardProps) {
  const isProduct = item.type === 'PRODUCT'
  const name = item.name || item.title || 'Unknown'
  const price = item.dealsPrice || item.salesPrice || item.price || 0

  return (
    <Card variant="elevated" className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300">
      <Link href={isProduct ? `/marketplace/product/${item.slug}` : `/services/${item.slug}`}>
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {item.image ? (
            <Image src={item.image} alt={name} className="object-cover" fill loading="lazy" sizes={CARD_IMAGE_SIZES} placeholder="blur" blurDataURL={getBlurDataURL()} />
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