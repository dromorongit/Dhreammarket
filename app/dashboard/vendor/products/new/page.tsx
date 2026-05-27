'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import ImageUpload from '@/components/ImageUpload'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  slug?: string
  parentId: string | null
  children?: Category[]
}

export default function NewProduct() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true) // Start with true to show loading state while fetching
  const [saving, setSaving] = useState(false)
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    categoryId: '',
    imageUrls: [''],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([
        checkOnboardingStatus(),
        fetchCategories()
      ])
      setLoading(false)
    }
    loadAllData()
  }, [])

  // Debug: Verify React re-renders when categories change
  useEffect(() => {
    console.log('[RENDER] Categories changed:', categories)
    console.log('[RENDER] Categories length:', categories.length)
  }, [categories])

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/store')
      if (response.ok) {
        const data = await response.json()
        // If store exists and has categoryId, vendor is onboarded
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
      console.log('[FRONTEND] Fetching categories...')
      const response = await fetch('/api/categories')
      console.log('[FRONTEND] Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('[FRONTEND] Response data:', data)
        console.log('[FRONTEND] Categories state BEFORE set:', categories)
        setCategories(data.categories)
        console.log('[FRONTEND] Categories state AFTER set:', data.categories)
      } else {
        console.error('[FRONTEND] Response not OK:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('[FRONTEND] Error fetching categories:', error)
    }
  }

  // Render hierarchical category options for dropdown
  const renderCategoryOptions = (cats: Category[], level = 0): React.ReactNode[] => {
    const options: React.ReactNode[] = []
    cats.forEach((cat) => {
      options.push(
        <option key={cat.id} value={cat.id} style={{ paddingLeft: level * 16 }}>
          {'\u00A0'.repeat(level * 4)}{level > 0 ? '↳ ' : ''}{cat.name}
        </option>
      )
      if (cat.children && cat.children.length > 0) {
        options.push(...renderCategoryOptions(cat.children, level + 1))
      }
    })
    return options
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSaving(true)

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        imageUrls: formData.imageUrls.filter(url => url.trim() !== ''),
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      })

      if (response.ok) {
        const data = await response.json()
        alert('Product created successfully!')
        router.push('/dashboard/vendor/products')
      } else {
        const error = await response.json()
        if (error.error) {
          setErrors({ general: error.error })
        }
      }
    } catch (error) {
      console.error('Error creating product:', error)
      setErrors({ general: 'An error occurred while creating the product' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
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
                You need to set up your store and select a category before adding products.
              </p>
              <Link href="/dashboard/vendor/store">
                <Button>Complete Store Setup</Button>
              </Link>
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
            onClick={() => router.push('/dashboard/vendor/products')}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
          >
            ← Back to Products
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-600 mt-2">Create a new product listing for your store</p>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">Product Information</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter product name"
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
                  placeholder="Describe your product"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                    Price (GHS) *
                  </label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-2">
                    Stock Quantity *
                  </label>
                  <Input
                    id="stock"
                    name="stock"
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={handleChange}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                  <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
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
                     {renderCategoryOptions(categories)}
                   </select>
               </div>

              <div>
                <ImageUpload
                  value={formData.imageUrls}
                  onChange={(urls) => setFormData(prev => ({ ...prev, imageUrls: urls }))}
                  folder="products"
                  maxFiles={10}
                  maxSizeMB={5}
                  label="Product Images"
                  hint="Upload high-quality images of your product. The first image will be used as the main product image."
                />
              </div>

              {errors.general && (
                <div className="text-red-600 text-sm">{errors.general}</div>
              )}

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/vendor/products')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating Product...' : 'Create Product'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}