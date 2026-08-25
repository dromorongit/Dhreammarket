'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { StarRating } from '@/components/StarRating'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'
import { getBlurDataURL } from '@/lib/image-utils'
import { FiChevronLeft, FiChevronRight, FiExternalLink } from 'react-icons/fi'

interface Product {
  id: string
  slug: string
  name: string
  price: number
  averageRating: number
  images: Array<{ url: string; alt: string | null }>
  category: { id: string; name: string; slug: string } | null
  store: { name: string } | null
}

export default function WorthDiscovering() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/homepage/random-products', {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Failed to fetch random products')
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching worth discovering products:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const goTo = (index: number) => {
    if (products.length === 0) return
    setCurrentIndex((index + products.length) % products.length)
  }

  const goNext = () => goTo(currentIndex + 1)
  const goPrev = () => goTo(currentIndex - 1)

  if (loading) {
    return (
      <section className="relative py-10 lg:py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
          <Skeleton className="w-full aspect-[16/9] rounded-3xl" />
        </div>
      </section>
    )
  }

  if (products.length === 0) {
    return null
  }

  const product = products[currentIndex]
  const productUrl = `/marketplace/product/${product.slug ?? product.id}`
  const shopUrl = '/marketplace'
  const image = product.images?.[0]
  const imageUrl = image ? getOptimizedCloudinaryUrl(image.url, 1200) : null

  return (
    <section className="relative py-10 lg:py-14 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy">
              Worth discovering.
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-xl">
              Handpicked products picked just for you. refreshed randomly on every visit.
            </p>
          </div>
          <Link href={shopUrl}>
            <Button size="sm" className="rounded-full px-5 py-2 text-xs font-semibold shadow-sm hover:shadow-md transition-all">
              Explore products
            </Button>
          </Link>
        </div>

        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-3xl overflow-hidden bg-slate-900 group">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={image.alt || product.name}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="100vw"
              placeholder="blur"
              blurDataURL={getBlurDataURL()}
              unoptimized
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2">
            <Badge variant="premium" className="text-[10px] sm:text-xs">FEATURED</Badge>
            {product.category && (
              <Badge variant="default" className="text-[10px] sm:text-xs bg-white/20 text-white border-white/30">
                {product.category.name}
              </Badge>
            )}
          </div>

          <Link href={productUrl} className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <span className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-colors">
              <FiExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
          </Link>

          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
            <p className="text-[10px] sm:text-xs font-semibold text-premium-gold tracking-widest uppercase mb-1 sm:mb-2">
              Featured Selection
            </p>
            <h3 className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 line-clamp-2">
              {product.name}
            </h3>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <span className="text-lg sm:text-2xl font-bold text-white">
                {formatPrice(product.price)}
              </span>
              <StarRating rating={Math.round(product.averageRating)} size="sm" />
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Link href={productUrl}>
                <Button size="sm" className="rounded-full px-4 sm:px-6 text-xs sm:text-sm">
                  View product
                </Button>
              </Link>
              <Link href={shopUrl}>
                <Button variant="outline" size="sm" className="rounded-full px-4 sm:px-6 text-xs sm:text-sm border-white/40 text-white hover:bg-white/10">
                  Browse all
                </Button>
              </Link>
            </div>
          </div>

          {products.length > 1 && (
            <>
              <div className="absolute bottom-5 sm:bottom-8 lg:bottom-10 left-5 sm:left-8 lg:left-10 flex items-center gap-1.5 sm:gap-2">
                {products.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goTo(idx)}
                    className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? 'w-6 sm:w-8 bg-white'
                        : 'w-1.5 sm:w-2 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="absolute bottom-5 sm:bottom-8 lg:bottom-10 right-5 sm:right-8 lg:right-10 flex items-center gap-2">
                <button
                  onClick={goPrev}
                  className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-colors"
                  aria-label="Previous product"
                >
                  <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={goNext}
                  className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30 transition-colors"
                  aria-label="Next product"
                >
                  <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
