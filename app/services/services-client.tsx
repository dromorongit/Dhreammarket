'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import ServiceCard from '@/components/ServiceCard'
import { formatPrice } from '@/lib/currency'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { MdVerified } from 'react-icons/md'

interface Service {
  id: string
  slug: string
  title: string
  shortDescription: string | null
  startingPrice: number
  pricingType: string
  deliveryType: string
  availabilityStatus: string
  status: string
  thumbnail: string | null
  gallery: string[]
  category: {
    id: string
    name: string
    slug: string
  }
  store: {
    id: string
    name: string
    slug: string
    isVerified: boolean
    badgeTier: string | null
    averageRating: number
    reviewCount: number
    logo: string | null
  }
  images: Array<{
    id: string
    imageUrl: string
    displayOrder: number
  }>
  tags: string[]
  estimatedDeliveryTime: string | null
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  isFeatured: boolean
  serviceCount?: number
}

interface ServicePagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

function ServicesContent() {
  const searchParams = useSearchParams()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [pagination, setPagination] = useState<ServicePagination>({ page: 1, limit: 12, total: 0, totalPages: 0 })
  const [sortBy, setSortBy] = useState('newest')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedPricingType, setSelectedPricingType] = useState('')
  const [selectedAvailability, setSelectedAvailability] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [wishlistServiceIds, setWishlistServiceIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const categoryParam = searchParams?.get('category') ?? ''
    const pricingParam = searchParams?.get('pricingType') ?? ''
    const availabilityParam = searchParams?.get('availabilityStatus') ?? ''
    const sortParam = searchParams?.get('sortBy') ?? 'newest'
    const searchParam = searchParams?.get('search') ?? ''
    setSelectedCategory(categoryParam)
    setSelectedPricingType(pricingParam)
    setSelectedAvailability(availabilityParam)
    setSortBy(sortParam)
    setSearchQuery(searchParam)
  }, [searchParams])

  useEffect(() => {
    fetchCategories()
    fetchServices()
    checkWishlistStatus()
  }, [])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchServices()
    }, 300)
    return () => clearTimeout(debounceTimer)
  }, [selectedCategory, selectedPricingType, selectedAvailability, minPrice, maxPrice, sortBy])

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/service-categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching service categories:', error)
    }
  }

  const fetchServices = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '12')
      params.set('sortBy', sortBy)
      params.set('sortOrder', 'desc')
      if (selectedCategory) params.set('categoryId', selectedCategory)
      if (selectedPricingType) params.set('pricingType', selectedPricingType)
      if (selectedAvailability) params.set('availabilityStatus', selectedAvailability)
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      if (searchQuery.trim()) params.set('search', searchQuery.trim())

      const response = await fetch(`/api/services?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setServices(data.services || [])
        setPagination(data.pagination || { page: 1, limit: 12, total: 0, totalPages: 0 })
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkWishlistStatus = async () => {
    try {
      const serviceIds = services.map(s => s.id).join(',')
      if (!serviceIds) return
      const response = await fetch(`/api/wishlist/check?serviceIds=${serviceIds}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistServiceIds(new Set(data.serviceIds || []))
      }
    } catch (error) {
      console.error('Error checking wishlist status:', error)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchQuery.trim()) params.set('search', searchQuery.trim())
    if (selectedCategory) params.set('category', selectedCategory)
    if (selectedPricingType) params.set('pricingType', selectedPricingType)
    if (selectedAvailability) params.set('availabilityStatus', selectedAvailability)
    if (sortBy !== 'newest') params.set('sortBy', sortBy)
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    const queryString = params.toString()
    window.history.replaceState(null, '', queryString ? `?${queryString}` : window.location.pathname)
    fetchServices()
  }

  const clearFilters = () => {
    setSelectedCategory('')
    setSelectedPricingType('')
    setSelectedAvailability('')
    setMinPrice('')
    setMaxPrice('')
    setSearchQuery('')
    setSortBy('newest')
    window.history.replaceState(null, '', '/services')
    setTimeout(() => fetchServices(), 0)
  }

  const getPricingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FIXED_PRICE: 'Fixed Price',
      FIXED: 'Fixed Price',
      STARTING_FROM: 'Starting From',
      HOURLY: 'Hourly',
      CUSTOM_QUOTE: 'Custom Quote',
    }
    return labels[type] || type
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <section className="relative bg-gradient-to-br from-deep-navy to-royal-blue py-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-premium-gold/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4">Services Marketplace</Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
              Discover Professional Services
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
              Browse curated services from verified vendors. Find the perfect service for your needs.
            </p>
            <form onSubmit={handleSearch} className="max-w-xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-white/20 bg-white/10 px-6 py-4 text-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm"
                />
                <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 hover:text-white transition-colors">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="lg:w-64 flex-shrink-0">
              <Card variant="elevated" className="p-6">
                <h3 className="text-sm font-semibold text-deep-navy mb-4">Filters</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                    <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50">
                      <option value="">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Pricing Type</label>
                    <select value={selectedPricingType} onChange={(e) => setSelectedPricingType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50">
                      <option value="">All Types</option>
                      <option value="FIXED_PRICE">Fixed Price</option>
                      <option value="STARTING_FROM">Starting From</option>
                      <option value="HOURLY">Hourly</option>
                      <option value="CUSTOM_QUOTE">Custom Quote</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Availability</label>
                    <select value={selectedAvailability} onChange={(e) => setSelectedAvailability(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50">
                      <option value="">All</option>
                      <option value="AVAILABLE">Available</option>
                      <option value="BUSY">Busy</option>
                      <option value="UNAVAILABLE">Unavailable</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Min Price</label>
                      <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="GH₵0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">Max Price</label>
                      <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50" />
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                    Clear All Filters
                  </Button>
                </div>
              </Card>
            </aside>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-deep-navy">Services</h2>
                  <span className="text-sm text-slate-500">({pagination.total} results)</span>
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50">
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : services.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  }
                  title="No services found"
                  description="Try adjusting your filters or search query."
                  actionLabel="Clear Filters"
                  onAction={clearFilters}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {services.map((service) => (
                      <ServiceCard key={service.id} service={service} wishlistServiceIds={wishlistServiceIds} />
                    ))}
                  </div>

                  {pagination.totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-between border-t pt-6">
                      <div className="text-sm text-slate-600">
                        Page {pagination.page} of {pagination.totalPages}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const prevPage = pagination.page - 1
                            const params = new URLSearchParams(window.location.search)
                            params.set('page', String(prevPage))
                            window.history.pushState(null, '', `?${params.toString()}`)
                            fetchServices()
                          }}
                          disabled={pagination.page === 1}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => {
                            const nextPage = pagination.page + 1
                            const params = new URLSearchParams(window.location.search)
                            params.set('page', String(nextPage))
                            window.history.pushState(null, '', `?${params.toString()}`)
                            fetchServices()
                          }}
                          disabled={pagination.page >= pagination.totalPages}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ServicesContent />
    </div>
  )
}