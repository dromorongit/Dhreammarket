'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface VendorProduct {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  images: Array<{
    id: string
    url: string
    alt: string | null
  }>
  category: {
    id: string
    name: string
  }
  reviewCount: number
}

interface VendorData {
  id: string
  name: string
  description: string | null
  isVerified: boolean
  isFeatured: boolean
  logo: string | null
  banner: string | null
  rating: number
  totalReviews: number
  createdAt: string
  category: {
    id: string
    name: string
    slug: string
  } | null
  products: VendorProduct[]
  productCount: number
}

export default function VendorProfilePage() {
  const params = useParams()
  const vendorId = params.id as string

  const [vendor, setVendor] = useState<VendorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!vendorId) return

    const fetchVendor = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/vendors/${vendorId}`)
        if (response.ok) {
          const data = await response.json()
          setVendor(data.vendor)
        } else {
          const errorData = await response.json()
          setError(errorData.error || 'Failed to load vendor profile')
        }
      } catch (err) {
        setError('Failed to load vendor profile')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchVendor()
  }, [vendorId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Banner Skeleton */}
          <div className="w-full h-64 bg-slate-200 rounded-lg mb-8 animate-pulse" />

          {/* Profile Header Skeleton */}
          <div className="bg-white rounded-lg shadow-sm p-8 mb-8 -mt-20 relative z-10 animate-pulse">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
              <div className="w-32 h-32 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-4">
                <div className="h-8 bg-slate-200 rounded w-1/3" />
                <div className="h-5 bg-slate-200 rounded w-1/4" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          </div>

          {/* Products Grid Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(12)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            title="Vendor Not Found"
            description={error || "The vendor you're looking for doesn't exist or hasn't completed their profile yet."}
            actionLabel="Back to Marketplace"
            onAction={() => window.location.href = '/marketplace'}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Banner */}
      {vendor.banner && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <img
            src={vendor.banner}
            alt={`${vendor.name} banner`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className={`bg-white rounded-lg shadow-sm p-8 mb-8 ${vendor.banner ? '-mt-20 relative z-10' : ''}`}>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            {/* Logo */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
              {vendor.logo ? (
                <img src={vendor.logo} alt={vendor.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-bold text-white">
                  {vendor.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Vendor Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <h1 className="text-3xl font-bold text-deep-navy">{vendor.name}</h1>
                {vendor.isVerified && (
                  <Badge variant="verified" size="md">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </Badge>
                )}
                {vendor.isFeatured && (
                  <Badge variant="premium" size="md">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Featured
                  </Badge>
                )}
              </div>

              {vendor.category && (
                <p className="text-slate-600 mb-2">
                  <Link href={`/marketplace?vendorCategory=${vendor.category.id}`} className="hover:text-royal-blue transition-colors">
                    {vendor.category.name}
                  </Link>
                </p>
              )}

              <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-slate-500 mb-4">
                <div className="flex items-center gap-1">
                  <svg className="w-5 h-5 text-premium-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                  <span>({vendor.totalReviews} reviews)</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span>{vendor.productCount} products</span>
                </div>
              </div>

              {vendor.description && (
                <p className="text-slate-600 max-w-2xl mb-6">{vendor.description}</p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button size="lg">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Vendor
                </Button>
                <Link href={`/marketplace?vendorCategory=${vendor.category?.id || ''}`}>
                  <Button variant="outline" size="lg">
                    View All Products
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Products */}
        <section className="py-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-deep-navy">
              Products from {vendor.name}
            </h2>
            <span className="text-sm text-slate-500">
              {vendor.products.length} products
            </span>
          </div>

          {vendor.products.length === 0 ? (
            <Card variant="elevated" className="p-12">
              <EmptyState
                icon={
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                title="No products yet"
                description="This vendor hasn't added any products yet. Check back soon!"
              />
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {vendor.products.map((product) => (
                <Card
                  key={product.id}
                  variant="elevated"
                  className="group overflow-hidden"
                >
                  <Link href={`/marketplace/product/${product.id}`} className="block">
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      {product.images.length > 0 ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].alt || product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100">
                          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      {product.stock === 0 && (
                        <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Sold Out
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-2 space-y-1">
                    <Link href={`/marketplace/product/${product.id}`} className="block">
                      <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                        {product.name}
                      </h3>
                    </Link>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-royal-blue leading-tight">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
