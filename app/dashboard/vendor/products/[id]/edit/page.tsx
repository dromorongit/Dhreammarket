'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import Link from 'next/link'

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  categoryId: string
  images: Array<{
    id: string
    url: string
    alt: string | null
  }>
}

export default function EditProduct() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
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
    checkOnboardingStatus()
    fetchCategories()
    fetchProduct()
  }, [productId])

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
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        setProduct(data.product)
        setFormData({
          name: data.product.name,
          description: data.product.description || '',
          price: data.product.price.toString(),
          stock: data.product.stock.toString(),
          categoryId: data.product.categoryId,
          imageUrls: data.product.images.length > 0
            ? data.product.images.map((img: any) => img.url)
            : [''],
        })
      } else {
        alert('Product not found')
        router.push('/dashboard/vendor/products')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      alert('Error loading product')
      router.push('/dashboard/vendor/products')
    } finally {
      setLoading(false)
    }
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

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      })

      if (response.ok) {
        const data = await response.json()
        alert('Product updated successfully!')
        router.push('/dashboard/vendor/products')
      } else {
        const error = await response.json()
        if (error.error) {
          setErrors({ general: error.error })
        }
      }
    } catch (error) {
      console.error('Error updating product:', error)
      setErrors({ general: 'An error occurred while updating the product' })
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

  const handleImageUrlChange = (index: number, value: string) => {
    const newImageUrls = [...formData.imageUrls]
    newImageUrls[index] = value
    setFormData(prev => ({
      ...prev,
      imageUrls: newImageUrls
    }))
  }

  const addImageUrl = () => {
    setFormData(prev => ({
      ...prev,
      imageUrls: [...prev.imageUrls, '']
    }))
  }

  const removeImageUrl = (index: number) => {
    if (formData.imageUrls.length > 1) {
      const newImageUrls = formData.imageUrls.filter((_, i) => i !== index)
      setFormData(prev => ({
        ...prev,
        imageUrls: newImageUrls
      }))
    }
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
                You need to set up your store and select a category before managing products.
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
          <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-gray-600 mt-2">Update your product information</p>
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
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Images
                </label>
                <div className="space-y-2">
                  {formData.imageUrls.map((url, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        type="url"
                        value={url}
                        onChange={(e) => handleImageUrlChange(index, e.target.value)}
                        placeholder="Enter image URL"
                        className="flex-1"
                      />
                      {formData.imageUrls.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeImageUrl(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addImageUrl}
                    className="w-full"
                  >
                    + Add Another Image
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Enter URLs for product images. The first image will be used as the main product image.
                </p>
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
                  {saving ? 'Updating Product...' : 'Update Product'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}