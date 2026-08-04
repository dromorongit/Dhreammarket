'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'
import { AIVendorInsights } from '@/components/ai'
import { AIRecommendations } from '@/components/ai'

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

        <div className="flex gap-2 mb-8 border-b border-gray-200">
          {['overview', 'analytics', 'products', 'services', 'coupons', 'followers'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-royal-blue text-royal-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
          <Link href="/dashboard/vendor/advertising" className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors">
            Advertising
          </Link>
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
      </div>
    </div>
  )
}