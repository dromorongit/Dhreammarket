'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import ImageUpload from '@/components/ImageUpload'
import NeedHelpButton from '@/components/NeedHelpButton'

interface Store {
  id: string
  name: string
  description: string | null
  mainPhoneNumber: string | null
  alternativePhoneNumber: string | null
  whatsappNumber: string | null
  location: string
  categoryId: string | null
  acceptsPreOrders: boolean
  acceptsBackOrders: boolean
  logo?: string | null
  banner?: string | null
  category?: {
    id: string
    name: string
    slug: string
  } | null
}

interface Category {
  id: string
  name: string
  slug: string
}

export default function StoreManagement() {
  const router = useRouter()
  const [store, setStore] = useState<Store | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isNewStore, setIsNewStore] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    logo: '',
    banner: '',
    mainPhoneNumber: '',
    alternativePhoneNumber: '',
    whatsappNumber: '',
    location: '',
    acceptsPreOrders: false,
    acceptsBackOrders: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchStore()
    fetchCategories()
  }, [])

  const fetchStore = async () => {
    try {
      const response = await fetch('/api/store')
      if (response.ok) {
        const data = await response.json()
if (data.store) {
           setStore(data.store)
           setIsNewStore(false)
           setFormData({
             name: data.store.name,
             description: data.store.description || '',
             categoryId: data.store.categoryId || '',
             logo: data.store.logo || '',
             banner: data.store.banner || '',
             mainPhoneNumber: data.store.mainPhoneNumber || '',
             alternativePhoneNumber: data.store.alternativePhoneNumber || '',
             whatsappNumber: data.store.whatsappNumber || '',
             location: data.store.location || '',
             acceptsPreOrders: data.store.acceptsPreOrders || false,
             acceptsBackOrders: data.store.acceptsBackOrders || false,
           })
        } else {
          // Store doesn't exist yet
          setStore(null)
          setIsNewStore(true)
        }
      }
    } catch (error) {
      console.error('Error fetching store:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/vendor-categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    
    // Validate main phone number is required
    if (!formData.mainPhoneNumber || !formData.mainPhoneNumber.trim()) {
      setErrors({ mainPhoneNumber: 'Main phone number is required' })
      return
    }
    
    // Validate category selection - check for both null/undefined AND empty string
    if (!formData.categoryId || formData.categoryId === '') {
      setErrors({ categoryId: 'Vendor category is required' })
      return
    }

    // Validate location is required
    if (!formData.location || !formData.location.trim()) {
      setErrors({ location: 'Location is required' })
      return
    }

    setSaving(true)
    setSaveSuccess(false)

    try {
      const method = store ? 'PUT' : 'POST'
      const response = await fetch('/api/store', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        setStore(data.store)
        setSaveSuccess(true)
        
        // Navigate to vendor dashboard after successful store creation
        // Check if this was a new store (no store existed before) AND has a categoryId
        if (!store && data.store && data.store.categoryId) {
          // New store created with category - redirect to dashboard
          setTimeout(() => {
            router.push('/dashboard/vendor')
          }, 1500)
        } else {
          // Store updated or no category - just clear success message
          setTimeout(() => setSaveSuccess(false), 5000)
        }
      } else {
        const error = await response.json()
        if (error.error) {
          setErrors({ general: error.error })
        }
      }
    } catch (error) {
      console.error('Error saving store:', error)
      setErrors({ general: 'An error occurred while saving' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // Clear success message when user starts editing
    if (saveSuccess) {
      setSaveSuccess(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/vendor')}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
          >
            ← Back to Dashboard
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {store ? 'Manage Store' : 'Set Up Your Store'}
              </h1>
              <p className="text-gray-600 mt-2">
                {store
                  ? 'Update your store information'
                  : 'Create your store profile to start selling on Dhream Market'
                }
              </p>
            </div>
            <NeedHelpButton
              variant="outline"
              size="sm"
              category="VENDOR"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Store Information</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Store Name *
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your store name"
                />
              </div>

              <div>
                <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor Category *
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  required
                  value={formData.categoryId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choose the category that best describes your business type
                </p>
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
                  placeholder="Describe your store and what you offer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Contact Phone Numbers Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="mainPhoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Main Store Call Number *
                    </label>
                    <Input
                      id="mainPhoneNumber"
                      name="mainPhoneNumber"
                      type="tel"
                      required
                      value={formData.mainPhoneNumber}
                      onChange={handleChange}
                      placeholder="+233XXXXXXXXX"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Primary phone number for customers to contact your store
                    </p>
                  </div>

                  <div>
                    <label htmlFor="alternativePhoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                      Alternative Store Call Number
                    </label>
                    <Input
                      id="alternativePhoneNumber"
                      name="alternativePhoneNumber"
                      type="tel"
                      value={formData.alternativePhoneNumber}
                      onChange={handleChange}
                      placeholder="+233XXXXXXXXX"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Secondary/backup phone number (optional)
                    </p>
                  </div>

<div>
                     <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-2">
                       WhatsApp Number
                     </label>
                     <Input
                       id="whatsappNumber"
                       name="whatsappNumber"
                       type="tel"
                       value={formData.whatsappNumber}
                       onChange={handleChange}
                       placeholder="+233XXXXXXXXX"
                       className="w-full"
                     />
                     <p className="text-xs text-gray-500 mt-1">
                       WhatsApp contact number (optional)
                     </p>
                   </div>

                   <div>
                     <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                       Location *
                     </label>
                     <Input
                       id="location"
                       name="location"
                       type="text"
                       required
                       value={formData.location}
                       onChange={handleChange}
                       placeholder="Enter your store location"
                       className="w-full"
                     />
                     <p className="text-xs text-gray-500 mt-1">
                       Physical location of your store (city, region, or address)
                     </p>
                   </div>
                 </div>
               </div>

              {/* Pre-order and Backorder Settings Section */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Order Settings</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="acceptsPreOrders"
                        name="acceptsPreOrders"
                        type="checkbox"
                        checked={formData.acceptsPreOrders}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="acceptsPreOrders" className="text-sm font-medium text-gray-700">
                        Accept Pre-orders
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Allow customers to place orders for products not yet in stock
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="acceptsBackOrders"
                        name="acceptsBackOrders"
                        type="checkbox"
                        checked={formData.acceptsBackOrders}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3">
                      <label htmlFor="acceptsBackOrders" className="text-sm font-medium text-gray-700">
                        Accept Backorders
                      </label>
                      <p className="text-xs text-gray-500 mt-1">
                        Allow customers to place orders for out-of-stock products
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <ImageUpload
                  value={formData.logo ? [formData.logo] : []}
                  onChange={(urls) => setFormData(prev => ({
                    ...prev,
                    logo: urls.length > 0 ? urls[0] : ''
                  }))}
                  folder="logos"
                  maxFiles={1}
                  maxSizeMB={2}
                  label="Store Logo"
                  hint="Upload your store logo (recommended: square format, max 2MB)"
                />
              </div>

              <div>
                <ImageUpload
                  value={formData.banner ? [formData.banner] : []}
                  onChange={(urls) => setFormData(prev => ({
                    ...prev,
                    banner: urls.length > 0 ? urls[0] : ''
                  }))}
                  folder="banners"
                  maxFiles={1}
                  maxSizeMB={5}
                  label="Store Banner"
                  hint="Upload a banner image for your store page (recommended: 1200x400px, max 5MB)"
                />
              </div>

              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Store {store ? 'updated' : 'created'} successfully!
                      </p>
                      <p className="text-sm text-green-700 mt-1">
                        {store 
                          ? 'Your changes have been saved and will persist after page refresh.'
                          : 'Redirecting to your dashboard...'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {errors.mainPhoneNumber && (
                <div className="text-red-600 text-sm">{errors.mainPhoneNumber}</div>
              )}
              {errors.categoryId && (
                <div className="text-red-600 text-sm">{errors.categoryId}</div>
              )}
              {errors.location && (
                <div className="text-red-600 text-sm">{errors.location}</div>
              )}
              {errors.general && (
                <div className="text-red-600 text-sm">{errors.general}</div>
              )}

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/vendor')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !formData.categoryId || formData.categoryId === '' || !formData.location || !formData.location.trim()}>
                  {saving ? 'Saving...' : store ? 'Update Store' : 'Create Store'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}