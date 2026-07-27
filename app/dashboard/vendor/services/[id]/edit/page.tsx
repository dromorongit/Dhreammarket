'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import ImageUpload from '@/components/ImageUpload'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  slug?: string
  description?: string
  icon?: string
}

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
  categoryId: string
  tags: string[]
  requirementsFromCustomer: string | null
  estimatedDeliveryTime: string | null
  isFeatured: boolean
}

export default function EditService() {
  const router = useRouter()
  const params = useParams()
  const serviceId = params!.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    shortDescription: '',
    startingPrice: '',
    pricingType: 'FIXED_PRICE',
    deliveryType: 'ONLINE',
    availabilityStatus: 'AVAILABLE',
    status: 'DRAFT',
    categoryId: '',
    requirementsFromCustomer: '',
    estimatedDeliveryTime: '',
    tags: '',
    thumbnail: '',
    gallery: [''] as string[],
    isFeatured: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([
        checkOnboardingStatus(),
        fetchCategories(),
        fetchService(),
      ])
      setLoading(false)
    }
    loadAllData()
  }, [serviceId])

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

  const fetchService = async () => {
    try {
      const response = await fetch(`/api/vendor/services/${serviceId}`)
      if (response.ok) {
        const data = await response.json()
        const s = data.service as Service
        setService(s)

        const imageUrls = s.images?.map((img) => img.imageUrl) || []

        setFormData({
          title: s.title,
          description: s.description || '',
          shortDescription: s.shortDescription || '',
          startingPrice: s.startingPrice.toString(),
          pricingType: s.pricingType,
          deliveryType: s.deliveryType,
          availabilityStatus: s.availabilityStatus,
          status: s.status,
          categoryId: s.categoryId,
          requirementsFromCustomer: s.requirementsFromCustomer || '',
          estimatedDeliveryTime: s.estimatedDeliveryTime || '',
          tags: s.tags?.join(', ') || '',
          thumbnail: s.thumbnail || '',
          gallery: imageUrls.length > 0 ? imageUrls : [''],
          isFeatured: s.isFeatured,
        })
      } else {
        alert('Service not found')
        router.push('/dashboard/vendor/services')
      }
    } catch (error) {
      console.error('Error loading service:', error)
      alert('Error loading service')
      router.push('/dashboard/vendor/services')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSaving(true)

    if (!formData.title.trim()) {
      setErrors({ title: 'Service title is required' })
      setSaving(false)
      return
    }

    if (!formData.categoryId) {
      setErrors({ categoryId: 'Please select a service category' })
      setSaving(false)
      return
    }

    if (!formData.startingPrice || parseFloat(formData.startingPrice) < 0) {
      setErrors({ startingPrice: 'Valid starting price is required' })
      setSaving(false)
      return
    }

    try {
      const tagsArray = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const galleryUrls = formData.gallery.filter(url => url.trim() !== '')
      const images = galleryUrls.map((url, index) => ({
        imageUrl: url,
        displayOrder: index,
      }))

      const serviceData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        shortDescription: formData.shortDescription.trim() || null,
        startingPrice: parseFloat(formData.startingPrice),
        pricingType: formData.pricingType,
        deliveryType: formData.deliveryType,
        availabilityStatus: formData.availabilityStatus,
        status: formData.status,
        categoryId: formData.categoryId,
        requirementsFromCustomer: formData.requirementsFromCustomer.trim() || null,
        estimatedDeliveryTime: formData.estimatedDeliveryTime.trim() || null,
        tags: tagsArray,
        thumbnail: formData.thumbnail || null,
        images,
        isFeatured: formData.isFeatured,
      }

      const response = await fetch(`/api/vendor/services/${serviceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData),
      })

      if (response.ok) {
        alert('Service updated successfully!')
        router.push('/dashboard/vendor/services')
      } else {
        const error = await response.json()
        if (error.error) {
          setErrors({ general: error.error })
        }
      }
    } catch (error) {
      console.error('Error updating service:', error)
      setErrors({ general: 'An error occurred while updating the service' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  if (isOnboarded === null || loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/vendor/services')}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
          >
            ← Back to Services
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Service</h1>
          <p className="text-gray-600 mt-2">Update your service information</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Service Information</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Service Title *
                </label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter service title"
                />
                {errors.title && <div className="text-red-600 text-sm mt-1">{errors.title}</div>}
              </div>

              <div>
                <label htmlFor="shortDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description
                </label>
                <textarea
                  id="shortDescription"
                  name="shortDescription"
                  rows={2}
                  value={formData.shortDescription}
                  onChange={handleChange}
                  placeholder="Brief summary of your service"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe your service in detail"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startingPrice" className="block text-sm font-medium text-gray-700 mb-2">
                    Starting Price (GHS) *
                  </label>
                  <Input
                    id="startingPrice"
                    name="startingPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.startingPrice}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                  {errors.startingPrice && <div className="text-red-600 text-sm mt-1">{errors.startingPrice}</div>}
                </div>
                <div>
                  <label htmlFor="pricingType" className="block text-sm font-medium text-gray-700 mb-2">
                    Pricing Type
                  </label>
                  <select
                    id="pricingType"
                    name="pricingType"
                    value={formData.pricingType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="FIXED_PRICE">Fixed Price</option>
                    <option value="STARTING_FROM">Starting From</option>
                    <option value="HOURLY">Hourly</option>
                    <option value="CUSTOM_QUOTE">Custom Quote</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="deliveryType" className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Type
                  </label>
                  <select
                    id="deliveryType"
                    name="deliveryType"
                    value={formData.deliveryType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ONLINE">Online</option>
                    <option value="REMOTE">Remote</option>
                    <option value="ON_SITE">On Site</option>
                    <option value="HOME_SERVICE">Home Service</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="estimatedDeliveryTime" className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Delivery Time
                  </label>
                  <Input
                    id="estimatedDeliveryTime"
                    name="estimatedDeliveryTime"
                    type="text"
                    value={formData.estimatedDeliveryTime}
                    onChange={handleChange}
                    placeholder="e.g., 3-5 business days"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                    Service Category *
                  </label>
                  <select
                    id="categoryId"
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {errors.categoryId && <div className="text-red-600 text-sm mt-1">{errors.categoryId}</div>}
                </div>
                <div>
                  <label htmlFor="availabilityStatus" className="block text-sm font-medium text-gray-700 mb-2">
                    Availability Status
                  </label>
                  <select
                    id="availabilityStatus"
                    name="availabilityStatus"
                    value={formData.availabilityStatus}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="AVAILABLE">Available</option>
                    <option value="BUSY">Busy</option>
                    <option value="UNAVAILABLE">Unavailable</option>
                    <option value="TEMPORARILY_CLOSED">Temporarily Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Service Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>

              <div>
                <label htmlFor="requirementsFromCustomer" className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements From Customer
                </label>
                <textarea
                  id="requirementsFromCustomer"
                  name="requirementsFromCustomer"
                  rows={3}
                  value={formData.requirementsFromCustomer}
                  onChange={handleChange}
                  placeholder="What do you need from the customer to get started?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
                  Service Tags
                </label>
                <Input
                  id="tags"
                  name="tags"
                  type="text"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="e.g., design, logo, branding (comma separated)"
                />
                <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
              </div>

              <ImageUpload
                value={formData.thumbnail ? [formData.thumbnail] : []}
                onChange={(urls) => setFormData(prev => ({ ...prev, thumbnail: urls[0] || '' }))}
                folder="services"
                maxFiles={1}
                maxSizeMB={5}
                label="Cover Image"
                hint="Upload a cover image for your service."
              />

              <ImageUpload
                value={formData.gallery}
                onChange={(urls) => setFormData(prev => ({ ...prev, gallery: urls }))}
                folder="services"
                maxFiles={5}
                maxSizeMB={5}
                label="Gallery Images"
                hint="Upload additional images for your service gallery."
              />

              <div className="flex items-center gap-2">
                <input
                  id="isFeatured"
                  name="isFeatured"
                  type="checkbox"
                  checked={formData.isFeatured}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isFeatured" className="block text-sm font-medium text-gray-700">
                  Feature this service
                </label>
              </div>

              {errors.general && (
                <div className="text-red-600 text-sm">{errors.general}</div>
              )}

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/vendor/services')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Updating Service...' : 'Update Service'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
