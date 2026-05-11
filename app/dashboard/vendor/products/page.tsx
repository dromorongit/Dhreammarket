'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { formatPrice } from '@/lib/currency'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  category: {
    id: string
    name: string
  }
  images: Array<{
    id: string
    url: string
    alt: string | null
  }>
}

export default function VendorProducts() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null)

  useEffect(() => {
    checkOnboardingStatus()
    fetchProducts()
  }, [])

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

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return
    }

    setDeleting(productId)
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setProducts(products.filter(p => p.id !== productId))
        alert('Product deleted successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete product')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('An error occurred while deleting the product')
    } finally {
      setDeleting(null)
    }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button
              onClick={() => router.push('/dashboard/vendor')}
              className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900">My Products</h1>
            <p className="text-gray-600 mt-2">Manage your product listings</p>
          </div>
          <Link href="/dashboard/vendor/products/new">
            <Button>
              + Add New Product
            </Button>
          </Link>
        </div>

        {products.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
              <p className="text-gray-600 mb-6">Start by adding your first product to the marketplace.</p>
              <Link href="/dashboard/vendor/products/new">
                <Button>Add Your First Product</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-0">
                  <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-t-lg overflow-hidden">
                    {product.images.length > 0 ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].alt || product.name}
                        className="w-full h-48 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-48 flex items-center justify-center bg-gray-100">
                        <span className="text-gray-400 text-sm">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                      {product.description || 'No description'}
                    </p>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-lg font-bold text-blue-600">
                        {formatPrice(product.price)}
                      </span>
                      <span className="text-sm text-gray-500">
                        Stock: {product.stock}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                      Category: {product.category.name}
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/dashboard/vendor/products/${product.id}/edit`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDelete(product.id)}
                        disabled={deleting === product.id}
                      >
                        {deleting === product.id ? 'Deleting...' : 'Delete'}
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