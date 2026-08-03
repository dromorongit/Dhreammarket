'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { StarRating } from '@/components/StarRating'

interface CompareProduct {
  id: string
  name: string
  price: number
  salesPrice?: number
  dealsPrice?: number
  stock: number
  averageRating: number
  reviewCount: number
  images: { url: string }[]
  store: { name: string; averageRating: number; reviewCount: number }
  category: { name: string }
  variants?: { color?: string; size?: string; stock: number }[]
  brand?: string
  availabilityType?: string
  estimatedFulfillmentDays?: number
}

export default function ComparePage() {
  const [products, setProducts] = useState<CompareProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCompareList()
  }, [])

  const fetchCompareList = async () => {
    try {
      const response = await fetch('/api/compare')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching compare list:', error)
    } finally {
      setLoading(false)
    }
  }

  const removeProduct = async (productId: string) => {
    try {
      const response = await fetch('/api/compare', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      if (response.ok) {
        setProducts(products.filter(p => p.id !== productId))
      }
    } catch (error) {
      console.error('Error removing from compare:', error)
    }
  }

  const attributes = [
    { key: 'price', label: 'Price' },
    { key: 'salesPrice', label: 'Sale Price' },
    { key: 'dealsPrice', label: 'Deals Price' },
    { key: 'stock', label: 'Stock' },
    { key: 'averageRating', label: 'Rating' },
    { key: 'reviewCount', label: 'Reviews' },
    { key: 'brand', label: 'Brand' },
    { key: 'availabilityType', label: 'Availability' },
    { key: 'estimatedFulfillmentDays', label: 'Delivery (days)' },
    { key: 'store', label: 'Vendor' },
  ]

  const getAttributeValue = (product: CompareProduct, attrKey: string) => {
    switch (attrKey) {
      case 'price':
      case 'salesPrice':
      case 'dealsPrice':
      case 'stock':
      case 'averageRating':
      case 'reviewCount':
      case 'estimatedFulfillmentDays':
        return product[attrKey as keyof CompareProduct] as number | undefined
      case 'brand':
        return product.brand || '—'
      case 'availabilityType':
        return product.availabilityType || '—'
      case 'store':
        return product.store?.name || '—'
      default:
        return '—'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-deep-navy mb-8">Compare Products</h1>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-32"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-3xl font-bold text-deep-navy mb-4">Compare Products</h1>
          <p className="text-gray-500 mb-8">You haven&apos;t added any products to compare yet.</p>
          <Link href="/marketplace">
            <Button>Browse Products</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Compare Products</h1>
            <p className="text-gray-500 mt-1">{products.length}/4 products selected</p>
          </div>
          <Link href="/marketplace">
            <Button variant="outline">Continue Shopping</Button>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-4 text-sm font-semibold text-gray-500 w-48">Attribute</th>
                  {products.map((product) => (
                    <th key={product.id} className="p-4 min-w-[200px]">
                      <div className="relative">
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-full flex items-center justify-center text-sm"
                        >
                          ×
                        </button>
                         <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                           {product.images?.[0] ? (
                             <Image
                               src={product.images[0].url}
                               alt={product.name}
                               className="object-cover"
                               fill
                               sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                             />
                           ) : (
                            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                        <h3 className="font-semibold text-deep-navy text-sm line-clamp-2 mb-1">{product.name}</h3>
                        <p className="text-xs text-gray-500">{product.store?.name}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <StarRating rating={product.averageRating} size="sm" />
                          <span className="text-xs text-gray-500">({product.reviewCount})</span>
                        </div>
                        <div className="mt-3">
                          <p className="text-lg font-bold text-deep-navy">GHS {product.price.toFixed(2)}</p>
                          {product.salesPrice && product.salesPrice < product.price && (
                            <p className="text-sm text-gray-500 line-through">GHS {product.price.toFixed(2)}</p>
                          )}
                        </div>
                        <Link href={`/marketplace/product/${product.id}`}>
                          <Button size="sm" className="w-full mt-3">View Product</Button>
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attributes.map((attr) => (
                  <tr key={attr.key} className="border-b border-gray-100">
                    <td className="p-4 text-sm font-medium text-gray-500 bg-gray-50">{attr.label}</td>
                    {products.map((product) => (
                      <td key={product.id} className="p-4 text-sm text-gray-900">
                        {attr.key === 'averageRating' ? (
                          <div className="flex items-center gap-1">
                            <StarRating rating={getAttributeValue(product, attr.key) as number || 0} size="sm" />
                            <span>{getAttributeValue(product, attr.key)}</span>
                          </div>
                        ) : attr.key === 'stock' ? (
                          <Badge variant={(getAttributeValue(product, attr.key) as number || 0) > 0 ? 'success' : 'danger'}>
                            {(getAttributeValue(product, attr.key) as number || 0) > 0 ? 'In Stock' : 'Out of Stock'}
                          </Badge>
                        ) : (
                          getAttributeValue(product, attr.key) as any
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
