'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatPrice } from '@/lib/currency'
import { MdVerified } from 'react-icons/md'
import { type EnterpriseProduct } from '@/lib/homepage-product-utils'
import { getBlurDataURL } from '@/lib/image-utils'

const INITIAL_PRODUCT_COUNT = 10

function ProductRailItem({ product }: { product: EnterpriseProduct }) {
  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
  const hasDiscount = effectivePrice < product.price

  return (
    <div className="product-rail-item flex-shrink-0 w-[180px] sm:w-[220px] lg:w-[260px] h-[110px] sm:h-[130px] lg:h-[150px] relative overflow-hidden rounded-2xl">
      <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block w-full h-full">
        <div className="flex items-center gap-2.5 p-2.5 h-full bg-white/10 hover:bg-white/15 transition-colors duration-300 rounded-2xl">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 lg:w-18 lg:h-18 flex-shrink-0 overflow-hidden rounded-xl bg-slate-800">
            {product.images?.[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.images[0].alt || product.name}
                className="object-cover w-full h-full"
                fill
                sizes="(max-width: 640px) 70px, (max-width: 1024px) 90px, 110px"
                placeholder="blur"
                blurDataURL={getBlurDataURL()}
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-[11px] sm:text-xs font-semibold text-white line-clamp-2 leading-tight">
              {product.name}
            </h3>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[10px] sm:text-[11px] font-bold text-premium-gold">
                {formatPrice(effectivePrice)}
              </span>
              {hasDiscount && (
                <span className="text-[9px] sm:text-[10px] text-slate-400 line-through">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>
            {product.store && (
              <div className="flex items-center gap-1 min-w-0">
                <p className="text-[9px] sm:text-[10px] text-slate-400 truncate">
                  {product.store.name}
                </p>
                {product.store.isVerified && (
                  <MdVerified className="w-3 h-3 text-sky-400 flex-shrink-0" />
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}

export default function DynamicRandomProductRail() {
  const [products, setProducts] = useState<EnterpriseProduct[]>([])
  const [loading, setLoading] = useState(true)
  const trackRef = useRef<HTMLDivElement>(null)
  const isFetchingRef = useRef(false)

  const fetchRandomProducts = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true

    try {
      const response = await fetch('/api/products?limit=50')
      if (!response.ok) throw new Error('Failed to fetch products')
      const data = await response.json()
      const allProducts: EnterpriseProduct[] = data.products || []

      const availableProducts = allProducts.filter(
        (p: EnterpriseProduct) =>
          p.stock > 0 ||
          p.availabilityType === 'PREORDER' ||
          p.availabilityType === 'BACKORDER'
      )

      const shuffled = [...availableProducts].sort(() => Math.random() - 0.5)
      const selected = shuffled.slice(0, INITIAL_PRODUCT_COUNT)

      setProducts(selected)
    } catch (error) {
      console.error('Error fetching random products:', error)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    fetchRandomProducts()
  }, [fetchRandomProducts])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const handleAnimationIteration = () => {
      fetchRandomProducts()
    }

    track.addEventListener('animationiteration', handleAnimationIteration)
    return () => {
      track.removeEventListener('animationiteration', handleAnimationIteration)
    }
  }, [fetchRandomProducts])

  if (loading) {
    return (
       <section className="relative py-2 bg-slate-50 overflow-hidden" aria-label="Loading products">
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-premium-xl rail-container">
          <div className="rail-track product-rail-track">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="product-rail-item flex-shrink-0 w-[180px] sm:w-[220px] lg:w-[260px] h-[110px] sm:h-[130px] lg:h-[150px] bg-slate-800/50 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    return null
  }

  const duplicatedProducts = [...products, ...products]

  return (
     <section className="relative py-2 bg-slate-50 overflow-hidden" aria-label="Dynamic Random Products">
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-premium-xl rail-container">
        <div className="rail-track product-rail-track" ref={trackRef}>
          {duplicatedProducts.map((product, index) => (
            <ProductRailItem key={`${product.id}-${index}`} product={product} />
          ))}
        </div>
      </div>
    </section>
  )
}