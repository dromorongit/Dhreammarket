'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'
import dynamic from 'next/dynamic'

const AIVendorInsights = dynamic(() => import('@/components/ai').then(m => m.AIVendorInsights), { ssr: false })
const AIRecommendations = dynamic(() => import('@/components/ai').then(m => m.AIRecommendations), { ssr: false })

interface VendorProduct {
  id: string
  name: string
  price: number
  stock: number
  status: string
  category: { name: string }
  images: Array<{ id: string; url: string; alt: string | null }>
}

interface VendorService {
  id: string
  title: string
  startingPrice: number
  status: string
  availabilityStatus: string
  category: { name: string }
}

interface DashboardStats {
  revenue: { gross: number; net: number; earnings: number; orderCount: number }
  bookings: { count: number }
  topProducts: Array<{ id: string; name: string; salesCount: number; averageRating: number }>
  topServices: Array<{ id: string; title: string }>
  followerCount: number
}

const PAGE_SIZE = 10

export default function VendorDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [productsPage, setProductsPage] = useState(1)
  const [servicesPage, setServicesPage] = useState(1)
  const [allProducts, setAllProducts] = useState<VendorProduct[]>([])
  const [allServices, setAllServices] = useState<VendorService[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [servicesLoading, setServicesLoading] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/vendor')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProducts = useCallback(async (page: number) => {
    try {
      setProductsLoading(true)
      const res = await fetch(`/api/products?page=${page}&limit=${PAGE_SIZE}`)
      if (res.ok) {
        const data = await res.json()
        const products = Array.isArray(data?.products) ? data.products : []
        setAllProducts(products)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const fetchServices = useCallback(async (page: number) => {
    try {
      setServicesLoading(true)
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const res = await fetch(`/api/vendor/services?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        const services = Array.isArray(data?.services) ? data.services : []
        setAllServices(services)
      }
    } catch (err) {
      console.error('Error fetching services:', err)
    } finally {
      setServicesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts(productsPage)
    }
  }, [activeTab, productsPage, fetchProducts])

  useEffect(() => {
    if (activeTab === 'services') {
      fetchServices(servicesPage)
    }
  }, [activeTab, servicesPage, fetchServices])

  const totalProductPages = Math.ceil(allProducts.length / PAGE_SIZE)
  const totalServicePages = Math.ceil(allServices.length / PAGE_SIZE)
  const paginatedProducts = allProducts.slice(0, PAGE_SIZE)
  const paginatedServices = allServices.slice(0, PAGE_SIZE)

  const getProductStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success" size="sm">Published</Badge>
      case 'DRAFT':
        return <Badge variant="default" size="sm">Draft</Badge>
      case 'ARCHIVED':
        return <Badge variant="secondary" size="sm">Archived</Badge>
      default:
        return <Badge variant="default" size="sm">{status}</Badge>
    }
  }

  const getServiceStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success" size="sm">Published</Badge>
      case 'DRAFT':
        return <Badge variant="default" size="sm">Draft</Badge>
      default:
        return <Badge variant="default" size="sm">{status}</Badge>
    }
  }

  const getAvailabilityBadge = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return <Badge variant="success" size="sm">Available</Badge>
      case 'BUSY':
        return <Badge variant="warning" size="sm">Busy</Badge>
      case 'UNAVAILABLE':
        return <Badge variant="danger" size="sm">Unavailable</Badge>
      default:
        return <Badge variant="default" size="sm">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">Vendor Dashboard</h1>

         {/* Quick Actions */}
         <Card variant="elevated" className="mb-8">
           <CardContent className="p-6">
             <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Actions</h3>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/vendor/products">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-700">Manage Products</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/vendor/services">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 21c-2.794 0-5.37-.634-7.74-1.746M9 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                     <span className="text-sm font-medium text-slate-700">Manage Services</span>
                   </Link>
                 </Button>
                 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                   <Link href="/dashboard/vendor/store">
                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 21h16M5 21V7l8-4 8 4v14M9 21v-6h6v6" />
                       </svg>
                     </div>
                     <span className="text-sm font-medium text-slate-700">Manage Store</span>
                   </Link>
                 </Button>
                 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                   <Link href="/dashboard/vendor/orders">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-700">View Orders</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/vendor/service-requests">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-700">View Bookings</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/vendor/advertising">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-700">Advertising</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/vendor/subscription">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-700">Subscription</span>
                  </Link>
                </Button>
             </div>
           </CardContent>
         </Card>

        <div className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-0 sm:px-0 mb-8 pb-2">
          <div className="flex gap-2 whitespace-nowrap flex-nowrap touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
            {['overview', 'analytics', 'products', 'services', 'coupons', 'followers', 'advertising'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${
                  activeTab === tab
                    ? 'border-royal-blue text-royal-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'advertising' ? 'Advertising' : tab.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">Revenue</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-royal-blue">
                  {loading ? 'GH₵ 0.00' : formatCurrency(stats?.revenue?.gross ?? 0)}
                </p>
                <p className="text-sm text-gray-500">This month</p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">Orders</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-deep-navy">{loading ? '0' : (stats?.revenue?.orderCount ?? 0)}</p>
                <p className="text-sm text-gray-500">This month</p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">Followers</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-deep-navy">{loading ? '0' : (stats?.followerCount ?? 0)}</p>
                <p className="text-sm text-gray-500">Total followers</p>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <h3 className="font-semibold text-deep-navy">Conversion Rate</h3>
              </Card.Header>
              <Card.Content>
                <p className="text-2xl font-bold text-royal-blue">0%</p>
                <p className="text-sm text-gray-500">Views to purchases</p>
              </Card.Content>
            </Card>
          </div>

            <AIVendorInsights vendorId="" userId="" />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Analytics</h2>
            <p className="text-gray-500">Detailed analytics will appear here</p>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-deep-navy">My Products</h2>
              <Link href="/dashboard/vendor/products" className="text-royal-blue hover:underline">
                Manage Products
              </Link>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 mb-4">
                  Total Products: {allProducts.length}
                </p>
              </CardContent>
            </Card>
            {productsLoading ? (
              <div className="text-center py-8">Loading products...</div>
            ) : paginatedProducts.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No products found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {paginatedProducts.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-deep-navy truncate">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.category?.name ?? 'No category'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-deep-navy">
                          {formatCurrency(product.price)}
                        </span>
                        {getProductStatusBadge(product.status)}
                        <span className="text-sm text-gray-500">Stock: {product.stock}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {totalProductPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProductsPage((p) => Math.max(1, p - 1))}
                  disabled={productsPage <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {productsPage} of {totalProductPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProductsPage((p) => Math.min(totalProductPages, p + 1))}
                  disabled={productsPage >= totalProductPages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-deep-navy">My Services</h2>
              <Link href="/dashboard/vendor/services" className="text-royal-blue hover:underline">
                Manage Services
              </Link>
            </div>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-500 mb-4">
                  Total Services: {allServices.length}
                </p>
              </CardContent>
            </Card>
            {servicesLoading ? (
              <div className="text-center py-8">Loading services...</div>
            ) : paginatedServices.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No services found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {paginatedServices.map((service) => (
                  <Card key={service.id}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-deep-navy truncate">{service.title}</h3>
                        <p className="text-sm text-gray-500">{service.category?.name ?? 'No category'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-deep-navy">
                          {formatCurrency(service.startingPrice)}
                        </span>
                        {getServiceStatusBadge(service.status)}
                        {getAvailabilityBadge(service.availabilityStatus)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {totalServicePages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setServicesPage((p) => Math.max(1, p - 1))}
                  disabled={servicesPage <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {servicesPage} of {totalServicePages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setServicesPage((p) => Math.min(totalServicePages, p + 1))}
                  disabled={servicesPage >= totalServicePages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'coupons' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Coupon Performance</h2>
            <p className="text-gray-500">Coupon analytics will appear here</p>
          </div>
        )}

        {activeTab === 'followers' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Followers</h2>
            <p className="text-gray-500">Your follower list will appear here</p>
          </div>
        )}

        {activeTab === 'advertising' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Advertising</h2>
            <p className="text-gray-500">Manage your advertising campaigns</p>
          </div>
        )}
      </div>
    </div>
  )
}