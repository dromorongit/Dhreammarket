'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MdVerified } from 'react-icons/md'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import WishlistButton from '@/components/WishlistButton'
import { event } from '@/lib/gtag'
import { getCurrencySymbol } from '@/lib/platform-preferences'

interface SearchProduct {
  id: string
  slug: string | null
  name: string
  brand: string | null
  price: number
  image: string | null
  store: { id: string; name: string; isVerified: boolean; badgeTier?: string | null } | null
  type: string
}

interface SearchVendor {
  id: string
  slug: string | null
  name: string
  description: string | null
  logo: string | null
  isVerified: boolean
  badgeTier: string | null
  productCount: number
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

type FlatSearchItem =
  | (SearchProduct & { _group: 'Products' })
  | (SearchVendor & { _group: 'Vendors' })
  | (SearchCategory & { _group: 'Categories' })
  | (SearchBrand & { _group: 'Brands' })

interface SearchDropdownProps {
  onNavigate?: () => void
}

export function SearchDropdown({ onNavigate }: SearchDropdownProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [wishlistedProductIds, setWishlistedProductIds] = useState<Set<string>>(new Set())
  const [platformCurrency, setPlatformCurrency] = useState<string>((typeof window !== 'undefined' && window.__PLATFORM_CURRENCY__) || 'GHS')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__PLATFORM_CURRENCY__) {
      setPlatformCurrency(window.__PLATFORM_CURRENCY__)
    }
  }, [])

  const flatResults: FlatSearchItem[] = results
    ? [
        ...results.results.products.map((p) => ({ ...p, _group: 'Products' as const })),
        ...results.results.vendors.map((v) => ({ ...v, _group: 'Vendors' as const })),
        ...results.results.categories.map((c) => ({ ...c, _group: 'Categories' as const })),
        ...results.results.brands.map((b) => ({ ...b, _group: 'Brands' as const })),
      ]
    : []

const performSearch = useCallback(async (searchQuery: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    if (!searchQuery.trim()) {
      setResults(null)
      setIsOpen(false)
      return
    }

    event({ action: 'search', category: 'engagement', label: searchQuery })

    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`, {
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        setIsOpen(true)
        setActiveIndex(-1)
        const productIds = data.results.products.map((p: SearchProduct) => p.id).join(',')
        if (productIds) {
          fetchWishlistStatus(productIds)
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Search error:', error)
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }, [])

  const fetchWishlistStatus = useCallback(async (productIds: string) => {
    const controller = new AbortController()
    try {
      const response = await fetch(`/api/wishlist/check?productIds=${productIds}`, {
        signal: controller.signal,
      })
      if (response.ok) {
        const data = await response.json()
        setWishlistedProductIds(new Set(data.productIds ?? []))
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error fetching wishlist status:', error)
      }
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!query.trim()) {
      setResults(null)
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, performSearch])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Abort pending search on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // Type guard helpers
  const isProductItem = (item: FlatSearchItem): item is SearchProduct & { _group: 'Products' } =>
    item.type === 'product'

  const isVendorItem = (item: FlatSearchItem): item is SearchVendor & { _group: 'Vendors' } =>
    item.type === 'vendor'

  const isCategoryItem = (item: FlatSearchItem): item is SearchCategory & { _group: 'Categories' } =>
    item.type === 'category'

  const isBrandItem = (item: FlatSearchItem): item is SearchBrand & { _group: 'Brands' } =>
    item.type === 'brand'

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatResults.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`)
        onNavigate?.()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && flatResults[activeIndex]) {
          const item = flatResults[activeIndex]
if (isProductItem(item)) {
             router.push(`/marketplace/product/${item.slug ?? item.id}`)
           } else if (isVendorItem(item)) {
             router.push(`/vendor/${item.slug ?? item.id}`)
          } else if (isCategoryItem(item)) {
            router.push(`/marketplace?category=${encodeURIComponent(item.id)}`)
          } else if (isBrandItem(item)) {
            router.push(`/marketplace?brand=${encodeURIComponent(item.name)}`)
          }
          onNavigate?.()
        } else {
          router.push(`/search?q=${encodeURIComponent(query.trim())}`)
          onNavigate?.()
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleResultClick = () => {
    setIsOpen(false)
    setActiveIndex(-1)
    onNavigate?.()
  }

  const handleViewAll = () => {
    router.push(`/search?q=${encodeURIComponent(query.trim())}`)
    setIsOpen(false)
    onNavigate?.()
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-royal-blue/20 text-royal-blue font-medium rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
<div className="relative w-full isolate" ref={dropdownRef}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors pointer-events-none"
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
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && results && setIsOpen(true)}
          placeholder="Search products, vendors, categories, brands..."
          className="w-full h-10 pl-10 pr-10 rounded-full border border-slate-200/80 bg-white/90 backdrop-blur-sm text-base md:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/30 focus:border-royal-blue/50 focus:bg-white shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-200"
          aria-label="Search marketplace"
          aria-autocomplete="list"
          aria-controls="search-dropdown"
          aria-expanded={isOpen}
        />

        {/* Clear / Loading */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <svg
              className="w-4 h-4 text-royal-blue animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          {query && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults(null)
                setIsOpen(false)
                inputRef.current?.focus()
              }}
              className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && results && (
        <div
          id="search-dropdown"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-premium-xl border border-slate-200/80 z-[9999] animate-scale-in origin-top"
          style={{ animationDuration: '200ms' }}
        >
          <div className="max-h-[420px] overflow-y-auto">
            {/* Products */}
{results.results.products.length > 0 && (
              <div className="p-2">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Products
                </p>
                {results.results.products.slice(0, 3).map((product) => {
                  const flatIdx = flatResults.findIndex(
                    (r) => r.type === 'product' && (r as SearchProduct).id === product.id
                  )
                  return (
                    <div key={product.id} className="relative">
                      <WishlistButton
                        productId={product.id}
                        initialIsWishlisted={wishlistedProductIds.has(product.id)}
                        size="sm"
                        className="absolute top-2 right-2 z-10"
                      />
                      <Link
                        href={`/marketplace/product/${product.slug ?? product.id}`}
                        onClick={handleResultClick}
                        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                          flatIdx === activeIndex ? 'bg-royal-blue/8' : 'hover:bg-slate-50'
                        }`}
                        role="option"
                        aria-selected={flatIdx === activeIndex}
                      >
                        <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                          {product.image ? (
                            <Image
                              src={product.image}
                              alt={product.name}
                              width={56}
                              height={56}
                              className="object-cover rounded-lg w-14 h-14 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {highlightMatch(product.name, query)}
                          </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-semibold text-royal-blue">
                                {getCurrencySymbol(platformCurrency)}{product.price.toFixed(2)}
                              </span>
                            {product.brand && (
                              <span className="text-[10px] text-slate-400">· {highlightMatch(product.brand, query)}</span>
                            )}
                            {(() => {
                              const badgeInfo = getVendorBadgeInfo((product.store as any)?.badgeTier)
                              if (badgeInfo) {
                                const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                                return (
                                  <MdVerified className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                                )
                              }
                              if (product.store?.isVerified) {
                                return (
                                  <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0" />
                                )
                              }
                              return null
                            })()}
                          </div>
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Vendors */}
            {results.results.vendors.length > 0 && (
              <div className="p-2 border-t border-slate-100">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Vendors
                </p>
                {results.results.vendors.slice(0, 3).map((vendor) => {
                  const flatIdx = flatResults.findIndex(
                    (r) => r.type === 'vendor' && (r as SearchVendor).id === vendor.id
                  )
                  return (
                    <Link
                      key={vendor.id}
                      href={`/vendor/${vendor.slug ?? vendor.id}`}
                      onClick={handleResultClick}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                        flatIdx === activeIndex ? 'bg-royal-blue/8' : 'hover:bg-slate-50'
                      }`}
                      role="option"
                      aria-selected={flatIdx === activeIndex}
                    >
<div className="w-14 h-14 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                         {vendor.logo ? (
                           <Image
                             src={vendor.logo}
                             alt={vendor.name}
                             width={56}
                             height={56}
                             className="object-cover rounded-lg w-14 h-14 flex-shrink-0"
                           />
                         ) : (
                          <span className="text-sm font-bold text-white">
                            {vendor.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
<div className="flex-1 min-w-0">
                         <div className="flex items-center gap-1">
                           <p className="text-sm font-medium text-slate-800 truncate">
                             {highlightMatch(vendor.name, query)}
                           </p>
                           {(() => {
                             const badgeInfo = getVendorBadgeInfo(vendor.badgeTier as any)
                             if (badgeInfo) {
                               const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                               return (
                                 <MdVerified className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                               )
                             }
                             if (vendor.isVerified) {
                               return (
                                 <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0" />
                               )
                             }
                             return null
                           })()}
                         </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {vendor.productCount} products
                          {vendor.description && ` · ${vendor.description.slice(0, 40)}...`}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Categories */}
            {results.results.categories.length > 0 && (
              <div className="p-2 border-t border-slate-100">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Categories
                </p>
                {results.results.categories.slice(0, 3).map((category) => {
                  const flatIdx = flatResults.findIndex(
                    (r) => r.type === 'category' && (r as SearchCategory).id === category.id
                  )
                  return (
                    <Link
                      key={category.id}
                      href={`/marketplace?category=${encodeURIComponent(category.id)}`}
                      onClick={handleResultClick}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                        flatIdx === activeIndex ? 'bg-royal-blue/8' : 'hover:bg-slate-50'
                      }`}
                      role="option"
                      aria-selected={flatIdx === activeIndex}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-royal-blue/10 to-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {highlightMatch(category.name, query)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {category.productCount} products
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Brands */}
            {results.results.brands.length > 0 && (
              <div className="p-2 border-t border-slate-100">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Brands
                </p>
                {results.results.brands.slice(0, 3).map((brand, idx) => {
                  const flatIdx = flatResults.findIndex(
                    (r) => r.type === 'brand' && (r as SearchBrand).name === brand.name
                  )
                  return (
                    <Link
                      key={`${brand.name}-${idx}`}
                      href={`/marketplace?brand=${encodeURIComponent(brand.name)}`}
                      onClick={handleResultClick}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                        flatIdx === activeIndex ? 'bg-royal-blue/8' : 'hover:bg-slate-50'
                      }`}
                      role="option"
                      aria-selected={flatIdx === activeIndex}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-premium-gold/10 to-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-premium-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {highlightMatch(brand.name, query)}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {brand.productCount} products
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* No results */}
            {results.total === 0 && (
              <div className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">No results for &quot;{results.query}&quot;</p>
                <p className="text-xs text-slate-500 mt-1">Try different keywords</p>
              </div>
            )}

            {/* View all results */}
            {results.total > 0 && (
              <div className="p-2 border-t border-slate-100">
                <button
                  onClick={handleViewAll}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-royal-blue hover:bg-royal-blue/5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  View all {results.total} results for &quot;{results.query}&quot;
                </button>
              </div>
            )}
          </div>

          {/* Keyboard hint */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px]">esc</kbd>
                Close
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
