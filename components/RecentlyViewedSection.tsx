'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { getRecentlyViewed } from '@/lib/recently-viewed'
import { getBlurDataURL, CARD_IMAGE_SIZES_2COL } from '@/lib/image-utils'
import { formatPrice } from '@/lib/currency'
import ScrollableRow from './ScrollableRow'

interface ProductMinimal {
  id: string
  name: string
  slug: string
  price: number
  salesPrice: number | null
  dealsPrice: number | null
  stock: number
  image: string | null
  imageAlt: string | null
  storeName: string | null
}

export default function RecentlyViewedSection() {
  const [products, setProducts] = useState<ProductMinimal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ids = getRecentlyViewed()
    if (ids.length === 0) {
      setLoading(false)
      return
    }

    fetch('/api/products/by-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((res) => res.json())
      .then((data) => {
        const items = (data.products ?? []) as ProductMinimal[]
        setProducts(items.filter((p) => !!p.id && !!p.name))
      })
      .catch(() => {
        setProducts([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading || products.length === 0) {
    return null
  }

  return (
    <section className="relative py-10 lg:py-14 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-cream py-3 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy">
              Recently Viewed
            </h2>
            <p className="mt-1 text-[11px] text-deep-navy">Pick up where you left off</p>
          </div>
        </div>
        <ScrollableRow>
          {products.map((product) => {
            const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.price
            return (
              <Link
                key={product.id}
                href={`/marketplace/product/${product.slug ?? product.id}`}
                className="snap-start flex-shrink-0 w-[calc(50%-8px)] sm:w-[calc(25%-12px)] lg:w-[calc(20%-12px)]"
              >
                <Card variant="elevated" className="group flex flex-col overflow-hidden h-full border border-gold/20 hover:border-gold/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.imageAlt || product.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        fill
                        sizes={CARD_IMAGE_SIZES_2COL}
                        placeholder="blur"
                        blurDataURL={getBlurDataURL()}
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-2 space-y-1 flex-1 flex flex-col">
                    <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                      {product.name}
                    </h3>
                    <span className="text-[11px] font-bold text-royal-blue">
                      {formatPrice(effectivePrice)}
                    </span>
                    {product.storeName && (
                      <p className="text-[10px] text-slate-500 truncate">{product.storeName}</p>
                    )}
                  </div>
                </Card>
              </Link>
            )
          })}
        </ScrollableRow>
      </div>
    </section>
  )
}
