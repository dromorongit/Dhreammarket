'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { FiChevronLeft, FiChevronRight, FiArrowRight } from 'react-icons/fi'
import { TbSparkles } from 'react-icons/tb'
import { getBlurDataURL } from '@/lib/image-utils'

interface CategoryItem {
  name: string
  image: string
}

interface MatchedCategory {
  id: string
  slug: string
}

const CURATED_CATEGORIES: CategoryItem[] = [
  { name: 'Fashion & Clothing', image: '/images/fashions.jpg' },
  { name: 'Smartphones', image: '/images/smarts.jpg' },
  { name: 'Babies & Kids', image: '/images/babies.jpg' },
  { name: 'Nail Products', image: '/images/nails.jpg' },
  { name: 'Books & Education', image: '/images/books.jpg' },
  { name: 'Foods & Beverages', image: '/images/foods.jpg' },
]

export default function CuratedCategories() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [categoryMap, setCategoryMap] = useState<Map<string, MatchedCategory>>(new Map())
  const [productCounts, setProductCounts] = useState<Record<string, number>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCategories() {
      try {
        const response = await fetch('/api/categories')
        if (!response.ok) throw new Error('Failed to fetch categories')
        const data = await response.json()

        if (cancelled) return

        const map = new Map<string, MatchedCategory>()
        const flatten = (cats: Array<{ name: string; id: string; slug: string; children?: Array<{ name: string; id: string; slug: string }> }>) => {
          cats.forEach((cat) => {
            map.set(cat.name.toLowerCase(), { id: cat.id, slug: cat.slug })
            if (cat.children?.length) flatten(cat.children)
          })
        }
        flatten(data.categories ?? [])

        const matchedEntries = CURATED_CATEGORIES.map((c) => map.get(c.name.toLowerCase())).filter(Boolean) as MatchedCategory[]

        const countResults = await Promise.all(
          matchedEntries.map((entry) =>
            fetch(`/api/products?categoryId=${entry.id}&page=1&limit=1`).then((r) => r.json())
          )
        )

        if (!cancelled) {
          setCategoryMap(map)
          const counts: Record<string, number> = {}
          matchedEntries.forEach((entry, i) => {
            counts[entry.id] = countResults[i]?.pagination?.total ?? 0
          })
          setProductCounts(counts)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading curated categories:', error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCategories()
    return () => {
      cancelled = true
    }
  }, [])

  const resetAutoAdvance = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CURATED_CATEGORIES.length)
    }, 4000)
  }, [])

  useEffect(() => {
    if (CURATED_CATEGORIES.length <= 1) return
    resetAutoAdvance()
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [CURATED_CATEGORIES.length, resetAutoAdvance])

  const goTo = useCallback(
    (index: number) => {
      setCurrentIndex((index + CURATED_CATEGORIES.length) % CURATED_CATEGORIES.length)
      resetAutoAdvance()
    },
    [resetAutoAdvance]
  )

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo])
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo])

  if (loading) {
    return (
      <section className="relative py-10 lg:py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-6 w-40 rounded-full" />
          </div>
          <Skeleton className="w-full h-[400px] sm:h-[520px] lg:h-[560px] rounded-3xl" />
        </div>
      </section>
    )
  }

  const category = CURATED_CATEGORIES[currentIndex]
  const matched = categoryMap.get(category.name.toLowerCase())
  const categoryId = matched?.id ?? null
  const href = categoryId ? `/marketplace?category=${categoryId}` : '/marketplace'
  const count = categoryId ? productCounts[categoryId] ?? null : null
  const total = CURATED_CATEGORIES.length

  return (
    <section className="relative py-10 lg:py-14 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-violet-500 text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm">
                <TbSparkles className="w-3.5 h-3.5" />
                Curated Categories
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy leading-tight">
              Find your next favorite category.
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-xl">
              Explore our handpicked collections across the marketplace.
            </p>
          </div>
        </div>

        <div className="relative w-full h-[380px] sm:h-[480px] lg:h-[560px] rounded-3xl overflow-hidden bg-slate-900 group">
          <Link href={href} className="absolute inset-0 z-10">
            <Image
              src={category.image}
              alt={category.name}
              fill
              priority={currentIndex === 0}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="100vw"
              placeholder="blur"
              blurDataURL={getBlurDataURL()}
            />
          </Link>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest">
              Collection
            </span>
          </div>

          {count !== null && (
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] sm:text-xs font-semibold">
                {count} {count === 1 ? 'Product' : 'Products'}
              </span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
            <div className="flex items-center gap-3 mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-mono text-white/70 tracking-widest">
                {String(currentIndex + 1).padStart(2, '0')}
              </span>
              <span className="h-px w-6 sm:w-8 bg-white/40" />
              <span className="text-[10px] sm:text-xs font-mono text-white/70 tracking-widest">
                {String(total).padStart(2, '0')}
              </span>
            </div>

            <h3 className="text-xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 line-clamp-2">
              {category.name}
            </h3>

            <Link
              href={href}
              className="inline-flex items-center gap-1.5 text-sm sm:text-base text-white/90 hover:text-white font-medium transition-colors group/link"
            >
              Explore category
              <FiArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {total > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2 sm:gap-2.5">
              {CURATED_CATEGORIES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goTo(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex ? 'w-6 sm:w-8 bg-deep-navy' : 'w-2 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 text-deep-navy hover:bg-slate-50 transition-colors shadow-sm"
                aria-label="Previous category"
              >
                <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={goNext}
                className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 text-deep-navy hover:bg-slate-50 transition-colors shadow-sm"
                aria-label="Next category"
              >
                <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
