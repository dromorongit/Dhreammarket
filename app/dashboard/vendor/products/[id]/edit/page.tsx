'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import ImageUpload from '@/components/ImageUpload'
import { SearchableCategorySelector } from '@/components/SearchableCategorySelector'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  slug?: string
  parentId: string | null
  children?: Category[]
}

interface Brand {
  id: string
  name: string
  slug: string
  logo?: string | null
}

interface ProductVariant {
  id: string
  color?: string
  size?: string
  age?: string
  sku?: string
  stock?: number
  active?: boolean
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  salesPrice?: number | null
  dealsPrice?: number | null
  brandId?: string | null
  brand?: {
    id: string
    name: string
  } | null
  stock: number
  categoryId: string
  images: Array<{
    id: string
    url: string
    alt: string | null
  }>
  variants: ProductVariant[]
  categoryAssignments?: Array<{
    productCategoryId: string
    productCategory: {
      id: string
      name: string
    }
  }>
}

export default function EditProduct() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    salesPrice: '',
    dealsPrice: '',
    brandId: '',
    categoryIds: [] as string[],
    imageUrls: [''],
    variants: [] as ProductVariant[],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
  const AGE_OPTIONS = ['0-6 Months', '6-12 Months', '1-2 Years', '2-3 Years', '4-5 Years', '6-7 Years', '8-10 Years', '12-14 Years']

  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([
        checkOnboardingStatus(),
        fetchCategories(),
        fetchBrands(),
        fetchProduct()
      ])
      setLoading(false)
    }
    loadAllData()
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

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands')
      if (response.ok) {
        const data = await response.json()
        setBrands(data.brands || [])
      }
    } catch (error) {
      console.error('Error fetching brands:', error)
    }
  }

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        const p = data.product as Product
        setProduct(p)

        const categoryIds = (p.categoryAssignments || [])
          .map((assignment: any) => assignment.productCategoryId)
          .filter((id: string) => id)

        setFormData({
          name: p.name,
          description: p.description || '',
          price: p.price.toString(),
          stock: p.stock.toString(),
          salesPrice: p.salesPrice ? p.salesPrice.toString() : '',
          dealsPrice: p.dealsPrice ? p.dealsPrice.toString() : '',
          brandId: p.brandId || '',
          categoryIds: categoryIds.length > 0 ? categoryIds : [p.categoryId],
          imageUrls: p.images.length > 0
            ? p.images.map((img) => img.url)
            : [''],
          variants: p.variants || [],
        })
      } else {
        alert('Product not found')
        router.push('/dashboard/vendor/products')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      alert('Error loading product')
      router.push('/dashboard/vendor/products')
    }
  }

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { id: '', color: '', size: '', age: '', sku: '', stock: 0, active: true }]
    }))
  }

  const removeVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }))
  }

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    setFormData(prev => {
      const newVariants = [...prev.variants]
      newVariants[index] = { ...newVariants[index], [field]: value }
      return { ...prev, variants: newVariants }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSaving(true)

    if ((formData.categoryIds || []).length === 0) {
      setErrors({ general: 'Please select at least one category' })
      setSaving(false)
      return
    }

    try {
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        salesPrice: formData.salesPrice ? parseFloat(formData.salesPrice) : null,
        dealsPrice: formData.dealsPrice ? parseFloat(formData.dealsPrice) : null,
        brandId: formData.brandId || null,
        imageUrls: formData.imageUrls.filter(url => url.trim() !== ''),
        variants: formData.variants.filter(v => v.color || v.size || v.age),
      }

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      })

      if (response.ok) {
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

  const handleCategoryChange = (categoryIds: string[]) => {
    setFormData(prev => ({ ...prev, categoryIds }))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="salesPrice" className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Price (Optional)
                  </label>
                  <Input
                    id="salesPrice"
                    name="salesPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.salesPrice}
                    onChange={handleChange}
                    placeholder="Discounted price"
                  />
                </div>
                <div>
                  <label htmlFor="dealsPrice" className="block text-sm font-medium text-gray-700 mb-2">
                    Deals Price (Optional)
                  </label>
                  <Input
                    id="dealsPrice"
                    name="dealsPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.dealsPrice}
                    onChange={handleChange}
                    placeholder="Promotional price"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="brandId" className="block text-sm font-medium text-gray-700 mb-2">
                  Brand (Optional)
                </label>
                <select
                  id="brandId"
                  name="brandId"
                  value={formData.brandId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a brand (optional)</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Categories * (Max 3)
                </label>
                <SearchableCategorySelector
                  categories={categories || []}
                  selectedCategoryIds={formData.categoryIds || []}
                  onChange={handleCategoryChange}
                  maxCategories={3}
                  placeholder="Search product categories..."
                />
              </div>

              <ImageUpload
                value={formData.imageUrls}
                onChange={(urls) => setFormData(prev => ({ ...prev, imageUrls: urls }))}
                folder="products"
                maxFiles={10}
                maxSizeMB={5}
                label="Product Images"
                hint="Upload high-quality images of your product. The first image will be used as the main product image."
              />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Product Variants (Optional)
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                    + Add Variant
                  </Button>
                </div>
                {formData.variants.length > 0 && (
                  <div className="space-y-3">
                    {formData.variants.map((variant, index) => (
                      <div key={variant.id || index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">Variant {index + 1}</span>
                          <Button type="button" variant="danger" size="sm" onClick={() => removeVariant(index)}>
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Color</label>
                            <Input
                              type="text"
                              value={variant.color || ''}
                              onChange={(e) => updateVariant(index, 'color', e.target.value)}
                              placeholder="e.g., Red, Blue"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Size</label>
                            <select
                              value={variant.size || ''}
                              onChange={(e) => updateVariant(index, 'size', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                            >
                              <option value="">Select size</option>
                              {SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>{size}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Age</label>
                            <select
                              value={variant.age || ''}
                              onChange={(e) => updateVariant(index, 'age', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                            >
                              <option value="">Select age range</option>
                              {AGE_OPTIONS.map(age => (
                                <option key={age} value={age}>{age}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">SKU</label>
<Input
                               type="text"
                               value={variant.sku || ''}
                               onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                               placeholder="Stock keeping unit"
                             />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Stock</label>
<Input
                               type="number"
                               min="0"
                               value={variant.stock !== undefined ? variant.stock : ''}
                               onChange={(e) => updateVariant(index, 'stock', parseInt(e.target.value) || 0)}
                               placeholder="0"
                             />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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