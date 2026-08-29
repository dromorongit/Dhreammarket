import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { type EnterpriseBrand } from '@/lib/homepage-product-utils'

interface OfficialStoresProps {
  brands: EnterpriseBrand[]
}

const INITIAL_VISIBLE = 24

export default function OfficialStores({ brands }: OfficialStoresProps) {
  const [showAll, setShowAll] = useState(false)

  const visibleBrands = brands.filter((b) => b.logo)
  const displayed = showAll ? visibleBrands : visibleBrands.slice(0, INITIAL_VISIBLE)
  const hasMore = visibleBrands.length > INITIAL_VISIBLE

  if (visibleBrands.length === 0) return null

  return (
    <section className="py-10 lg:py-14 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy leading-tight">
              Official Stores
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-xl">
              Shop directly from your favorite brands.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
          {displayed.map((brand) => (
            <Link key={brand.id ?? brand.slug} href={`/marketplace?brand=${brand.slug}`}>
              <div className="group flex flex-col items-center gap-2 sm:gap-3 bg-gradient-to-br from-white via-white/95 to-slate-50/50 rounded-2xl border border-slate-100/80 shadow-premium hover:shadow-premium-xl hover:-translate-y-0.5 transition-all duration-300 p-3 sm:p-4 cursor-pointer">
                <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/80 overflow-hidden transition-transform duration-300 group-hover:scale-105">
                  <Image
                    src={brand.logo ?? ''}
                    alt={brand.name}
                    width={80}
                    height={80}
                    className="object-contain max-h-full w-full p-1"
                    unoptimized
                  />
                </div>
                <p className="text-[11px] sm:text-xs lg:text-sm font-semibold text-deep-navy text-center truncate w-full group-hover:text-royal-blue transition-colors duration-300">
                  {brand.name}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {hasMore && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full border border-slate-200 text-sm font-semibold text-deep-navy hover:bg-slate-50 transition-colors shadow-sm"
            >
              {showAll ? 'Show Less' : `Show All ${visibleBrands.length} Brands`}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
