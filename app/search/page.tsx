'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { MdVerified } from 'react-icons/md'

type SearchTab = 'all' | 'products' | 'vendors' | 'categories' | 'brands'

interface SearchProduct {
  id: string
  name: string
  brand: string | null
  price: number
  salesPrice?: number | null
  dealsPrice?: number | null
  stock: number
  image: string | null
  store: { id: string; name: string; isVerified: boolean } | null
  category: { id: string; name: string } | null
  type: string
}

interface SearchVendor {
  id: string
  name: string
  description: string | null
  logo: string | null
  isVerified: boolean
  isFeatured: boolean
  productCount: number
  category: { id: string; name: string; slug: string } | null
  type: string
}

interface SearchCategory {
  id: string
  name: string
  productCount: number
  type: string
}

interface SearchBrand {
  name: string
  productCount: number
  type: string
}

interface SearchResults {
  query: string
  results: {
    products: SearchProduct[]
    vendors: SearchVendor[]
    categories: SearchCategory[]
    brands: SearchBrand[]
  }
  total: number
}

const TABS: { key: SearchTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'products', label: 'Products' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'categories', label: 'Categories' },
  { key: 'brands', label: 'Brands' },
]

function SearchPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') || ''

  const [query, setQuery] = useState(initialQuery)
  const [activeTab, setActiveTab] = useState<SearchTab>('all')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(!!initialQuery)

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null)
      setHasSearched(false)
      return
    }

    setLoading(true)
    setHasSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery)
    }
  }, [initialQuery, performSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
      performSearch(trimmed)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e)
    }
  }

  const getFilteredResults = () => {
    if (!results) return { products: [], vendors: [], categories: [], brands: [], total: 0 }
    if (activeTab === 'all') {
      return {
        products: results.results.products,
        vendors: results.results.vendors,
        categories: results.results.categories,
        brands: results.results.brands,
        total: results.total,
      }
    }
    return {
      products: activeTab === 'products' ? results.results.products : [],
      vendors: activeTab === 'vendors' ? results.results.vendors : [],
      categories: activeTab === 'categories' ? results.results.categories : [],
      brands: activeTab === 'brands' ? results.results.brands : [],
      total:
        (activeTab === 'products' ? results.results.products.length : 0) +
        (activeTab === 'vendors' ? results.results.vendors.length : 0) +
        (activeTab === 'categories' ? results.results.categories.length : 0) +
        (activeTab === 'brands' ? results.results.brands.length : 0),
    }
  }

  const filtered = getFilteredResults()

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Search Header */}
      <section className="relative bg-gradient-to-br from-deep-navy to-royal-blue py-16 overflow-hidden">
         <div className="absolute inset-0">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
           <div className="absolute bottom-0 right-0 w-48 h-48 bg-premium-gold/10 rounded-full blur-2xl pointer-events-none"></div>
         </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
              Search Marketplace
            </h1>
            <p className="text-slate-300">
              Find products, vendors, categories, and brands
            </p>
          </div>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search products, vendors, categories, brands..."
                className="w-full rounded-2xl border border-white/20 bg-white/10 px-12 py-4 text-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 backdrop-blur-sm transition-all text-base"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setResults(null)
                    setHasSearched(false)
                    router.push('/search')
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        {hasSearched && results && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            {TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? results.total
                  : tab.key === 'products'
                  ? results.results.products.length
                  : tab.key === 'vendors'
                  ? results.results.vendors.length
                  : tab.key === 'categories'
                  ? results.results.categories.length
                  : results.results.brands.length

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? 'bg-royal-blue text-white shadow-lg shadow-royal-blue/30'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-2 text-xs ${
                      activeTab === tab.key ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        ) : hasSearched && results ? (
          <div className="space-y-8">
            {/* Products */}
            {(activeTab === 'all' || activeTab === 'products') &&
              filtered.products.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-xl font-bold text-deep-navy mb-4">
                      Products ({results.results.products.length})
                    </h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {filtered.products.map((product) => (
                      <CompactProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              )}

            {/* Vendors */}
            {(activeTab === 'all' || activeTab === 'vendors') &&
              filtered.vendors.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-xl font-bold text-deep-navy mb-4">
                      Vendors ({results.results.vendors.length})
                    </h2>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filtered.vendors.map((vendor) => (
                      <Link
                        key={vendor.id}
                        href={`/vendor/${vendor.id}`}
                        className="block"
                      >
                        <Card variant="elevated" className="group p-4 hover:shadow-xl transition-all duration-300">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center shrink-0 overflow-hidden">
                              {vendor.logo ? (
                                <img
                                  src={vendor.logo}
                                  alt={vendor.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-lg font-bold text-white">
                                  {vendor.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-semibold text-deep-navy truncate group-hover:text-royal-blue transition-colors">
                                  {vendor.name}
                                </h3>
                                {vendor.isVerified && (
                                  <Badge variant="verified" size="sm" className="text-[9px] px-1 py-0">
                                    ✓
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                {vendor.productCount} products
                                {vendor.category && ` · ${vendor.category.name}`}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            {/* Categories */}
            {(activeTab === 'all' || activeTab === 'categories') &&
              filtered.categories.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-xl font-bold text-deep-navy mb-4">
                      Categories ({results.results.categories.length})
                    </h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {filtered.categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/marketplace?category=${category.id}`}
                        className="block"
                      >
                        <Card variant="elevated" className="group p-4 text-center hover:shadow-xl transition-all duration-300">
                          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-royal-blue/10 to-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <h3 className="text-sm font-semibold text-deep-navy group-hover:text-royal-blue transition-colors line-clamp-1">
                            {category.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {category.productCount} products
                          </p>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            {/* Brands */}
            {(activeTab === 'all' || activeTab === 'brands') &&
              filtered.brands.length > 0 && (
                <div>
                  {activeTab === 'all' && (
                    <h2 className="text-xl font-bold text-deep-navy mb-4">
                      Brands ({results.results.brands.length})
                    </h2>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {filtered.brands.map((brand, idx) => (
                      <Link
                        key={`${brand.name}-${idx}`}
                        href={`/marketplace?brand=${encodeURIComponent(brand.name)}`}
                        className="block"
                      >
                        <Card variant="elevated" className="group p-4 text-center hover:shadow-xl transition-all duration-300">
                          <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-gradient-to-br from-premium-gold/10 to-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-premium-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                          </div>
                          <h3 className="text-sm font-semibold text-deep-navy group-hover:text-royal-blue transition-colors line-clamp-1">
                            {brand.name}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {brand.productCount} products
                          </p>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

            {/* Empty state for active tab */}
            {filtered.total === 0 && (
              <EmptyState
                icon={
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                title={`No results for "${results.query}"`}
                description={`No ${activeTab === 'all' ? 'results' : activeTab} found matching your search. Try different keywords.`}
              />
            )}
          </div>
        ) : (
          /* Initial empty state */
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-deep-navy mb-2">
              Discover Everything
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Search across products, trusted vendors, categories, and brands to find exactly what you need.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchPageContent />
    </Suspense>
  )
}

function SearchPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative bg-gradient-to-br from-deep-navy to-royal-blue py-16">
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white mb-8">
            <div className="h-10 w-64 bg-white/10 rounded-lg mx-auto mb-3 animate-pulse" />
            <div className="h-4 w-80 bg-white/10 rounded-lg mx-auto animate-pulse" />
          </div>
          <div className="h-12 bg-white/10 rounded-2xl animate-pulse" />
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 w-20 bg-slate-200 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="aspect-[4/3] bg-slate-100 animate-pulse" />
              <div className="p-2 space-y-1.5">
                <div className="h-3.5 w-3/4 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-2/5 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Compact Product Card (inline for search page) ─── */
function CompactProductCard({ product }: { product: SearchProduct }) {
  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.price
  const hasDiscount = (product.dealsPrice ?? product.salesPrice) != null
  const discountPercentage = hasDiscount && product.price > effectivePrice
    ? Math.round(((product.price - effectivePrice) / product.price) * 100) : 0

  return (
    <Link href={`/marketplace/product/${product.id}`} className="block">
      <Card variant="elevated" className="group flex flex-col overflow-hidden h-full">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {discountPercentage > 0 && (
            <div className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
              -{discountPercentage}%
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Sold Out
            </div>
          )}
        </div>
        <div className="p-2 space-y-1 flex-1 flex flex-col">
          <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 leading-tight">
            {product.name}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-royal-blue">
              {formatPrice(effectivePrice)}
            </span>
            {(product.dealsPrice ?? product.salesPrice) && (
              <span className="text-[10px] text-slate-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
          {product.store && (
            <div className="flex items-center gap-1 min-w-0">
              <p className="text-[10px] text-slate-500 truncate">
                {product.store.name}
              </p>
              {product.store.isVerified && (
                <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0 inline-block" />
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}

/* ─── SkeletonCard (inline for search page) ─── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-2 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-2/5 mt-1.5" />
      </div>
    </div>
  )
}
