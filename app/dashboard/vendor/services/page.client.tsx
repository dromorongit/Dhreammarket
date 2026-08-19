'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'
import { formatPrice } from '@/lib/currency'
import NeedHelpButton from '@/components/NeedHelpButton'

interface ServiceImage {
  id: string
  imageUrl: string
  displayOrder: number
}

interface Service {
  id: string
  title: string
  description: string | null
  shortDescription: string | null
  startingPrice: number
  pricingType: string
  deliveryType: string
  availabilityStatus: string
  status: string
  thumbnail: string | null
  images: ServiceImage[]
  category: {
    id: string
    name: string
  }
  tags: string[]
  requirementsFromCustomer: string | null
  estimatedDeliveryTime: string | null
}

export default function VendorServicesPageClient() {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [canCreateService, setCanCreateService] = useState<boolean | null>(null)

  useEffect(() => {
    checkOnboardingStatus()
    fetchCategories()
    checkServiceLimit()
  }, [])

  useEffect(() => {
    if (isOnboarded) {
      fetchServices()
    }
  }, [search, categoryFilter, statusFilter, availabilityFilter, sortBy, isOnboarded])

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/store')
      if (response.ok) {
        const data = await response.json()
        setIsOnboarded(!!data.store?.categoryId)
      } else {
        setIsOnboarded(false)
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      setIsOnboarded(false)
    }
  }

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

  const checkServiceLimit = async () => {
    try {
      const response = await fetch('/api/dashboard/vendor')
      if (response.ok) {
        const data = await response.json()
        const remaining = data.servicesRemaining
        if (remaining !== undefined && remaining !== -1 && remaining <= 0) {
          setCanCreateService(false)
        } else {
          setCanCreateService(true)
        }
      }
    } catch (error) {
      console.error('Error checking service limit:', error)
    }
  }

  const fetchServices = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter) params.set('categoryId', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (availabilityFilter) params.set('availabilityStatus', availabilityFilter)
      params.set('sortBy', sortBy)
      params.set('sortOrder', 'desc')
      params.set('page', '1')
      params.set('limit', '24')

      const response = await fetch(`/api/vendor/services?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setServices(data.services || [])
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      return
    }

    setDeleting(serviceId)
    try {
      const response = await fetch(`/api/vendor/services/${serviceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setServices(services.filter(s => s.id !== serviceId))
        alert('Service deleted successfully!')
      } else {
        const error = await response.json()
        alert(error.error || error.details || 'Failed to delete service')
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      alert('An error occurred while deleting the service')
    } finally {
      setDeleting(null)
    }
  }

  const getPricingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      FIXED_PRICE: 'Fixed Price',
      STARTING_FROM: 'Starting From',
      HOURLY: 'Hourly',
      CUSTOM_QUOTE: 'Custom Quote',
    }
    return labels[type] || type
  }

  const getAvailabilityBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
      AVAILABLE: 'success',
      BUSY: 'warning',
      UNAVAILABLE: 'danger',
      TEMPORARILY_CLOSED: 'default',
    }
    const labels: Record<string, string> = {
      AVAILABLE: 'Available',
      BUSY: 'Busy',
      UNAVAILABLE: 'Unavailable',
      TEMPORARILY_CLOSED: 'Temporarily Closed',
    }
    return <Badge variant={variants[status] || 'default'} size="sm">{labels[status] || status}</Badge>
  }

  const getStatusBadge = (status: string) => {
    return status === 'PUBLISHED' ? (
      <Badge variant="success" size="sm">Published</Badge>
    ) : (
      <Badge variant="default" size="sm">Draft</Badge>
    )
  }

  if (isOnboarded === null || loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 9l-.732-2.28A2 2 0 0115.567 7H18a2 2 0 012 2v5a2 2 0 01-2 2h-5l-1 1-1-1H9a2 2 0 01-2-2V7a2 2 0 012-2h2.432l1.132 2.707c.77 1.333-.192 2.541-1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Complete Your Store Setup</h3>
              <p className="text-gray-600 mb-6">
                You need to set up your store and select a category before managing services.
              </p>
              <Button asChild>
                <Link href="/dashboard/vendor/store">Complete Store Setup</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <button
              onClick={() => router.push('/dashboard/vendor')}
              className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">My Services</h1>
            <p className="text-gray-600 mt-2">Manage your service listings</p>
          </div>
          <div className="flex gap-3">
            <NeedHelpButton
              variant="outline"
              size="sm"
              category="VENDOR"
            />
            <Button asChild disabled={canCreateService === false}>
              <Link href="/dashboard/vendor/services/new">+ Add New Service</Link>
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <Input
                  placeholder="Search services..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="BUSY">Busy</option>
                  <option value="UNAVAILABLE">Unavailable</option>
                  <option value="TEMPORARILY_CLOSED">Temporarily Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="createdAt">Newest</option>
                  <option value="startingPrice">Price</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {services.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No services yet</h3>
              <p className="text-gray-600 mb-6">Start by adding your first service to the marketplace.</p>
              <Button asChild>
                <Link href="/dashboard/vendor/services/new">Add Your First Service</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-t-lg overflow-hidden">
                    {service.thumbnail || (service.images && service.images.length > 0) ? (
                      <Image
                        src={getOptimizedCloudinaryUrl(service.thumbnail || service.images[0]?.imageUrl || '', 400)}
                        alt={service.title}
                        width={400}
                        height={300}
                        className="w-full h-48 object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-gray-100">
                        <span className="text-gray-400 text-sm">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">{service.title}</h3>
                      {getStatusBadge(service.status)}
                    </div>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {service.shortDescription || service.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg font-bold text-blue-600">
                        {formatPrice(service.startingPrice)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getPricingTypeLabel(service.pricingType)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      {getAvailabilityBadge(service.availabilityStatus)}
                      <span className="text-xs text-gray-500">
                        {service.category.name}
                      </span>
                    </div>
                    {service.tags && service.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {service.tags.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/dashboard/vendor/services/${service.id}/edit`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDelete(service.id)}
                        disabled={deleting === service.id}
                      >
                        {deleting === service.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
