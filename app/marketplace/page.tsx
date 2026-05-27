'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface CartResponse {
  cart: {
    id: string | null
    items: Array<any>
    total: number
  }
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  category?: {
    id: string
    name: string
  }
  store?: {
    id: string
    name: string
    categoryId: string | null
  }
  images: Array<{
    id: string
    url: string
    alt: string | null
  }>
}

interface Category {
  id: string
  name: string
  slug?: string
  productCount?: number
  parentId?: string | null
  children?: Category[]
}

interface Vendor {
  id: string
  name: string
  description: string | null
  isVerified: boolean
  isFeatured: boolean
  logo: string | null
  rating: number
  productCount: number
  category: { id: string; name: string; slug: string } | null
}

function MarketplaceContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vendorCategories, setVendorCategories] = useState<Category[]>([])
  const [totalProductCount, setTotalProductCount] = useState(0)
  const [totalProductCategoryCount, setTotalProductCategoryCount] = useState(0)
  const [totalVendorCount, setTotalVendorCount] = useState(0)
  const [totalVendorCategoryCount, setTotalVendorCategoryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('')
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'products' | 'vendors'>('products')

  useEffect(() => {
    const categoryParam = searchParams.get('category') || ''
    const vendorCategoryParam = searchParams.get('vendorCategory') || ''
    setSelectedCategory(categoryParam)
    setSelectedVendorCategory(vendorCategoryParam)
    fetchProducts()
    fetchCategories()
    fetchVendorCategories()
    fetchVendors()
    fetchCounts()
  }, [searchParams])

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

  const fetchVendorCategories = async () => {
    try {
      const response = await fetch('/api/vendor-categories')
      if (response.ok) {
        const data = await response.json()
        setVendorCategories(data.categories)
      }
    } catch (error) {
      console.error('Error fetching vendor categories:', error)
    }
  }

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors')
      if (response.ok) {
        const data = await response.json()
        // Sort by featured first, then by rating, then by product count
        const sortedVendors = data.vendors.sort((a: Vendor, b: Vendor) => {
          if (a.isFeatured && !b.isFeatured) return -1
          if (!a.isFeatured && b.isFeatured) return 1
          if (b.rating !== a.rating) return b.rating - a.rating
          return b.productCount - a.productCount
        })
        setVendors(sortedVendors)
      }
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  // Fetch total counts for display
  const fetchCounts = async () => {
    try {
      // Get total product count
      const productsResponse = await fetch('/api/products')
      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        setTotalProductCount(productsData.products?.length || 0)
      }

      // Get total product category count
      const categoriesResponse = await fetch('/api/categories')
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        // Count all categories including children
        const countAllCategories = (cats: Category[]): number => {
          return cats.reduce((count, cat) => {
            return count + 1 + (cat.children ? countAllCategories(cat.children) : 0)
          }, 0)
        }
        setTotalProductCategoryCount(countAllCategories(categoriesData.categories || []))
      }

      // Get total vendor count
      const vendorsResponse = await fetch('/api/vendors?limit=1')
      if (vendorsResponse.ok) {
        const vendorsData = await vendorsResponse.json()
        setTotalVendorCount(vendorsData.pagination?.total || 0)
      }

      // Get total vendor category count
      const vendorCategoriesResponse = await fetch('/api/vendor-categories')
      if (vendorCategoriesResponse.ok) {
        const vendorCategoriesData = await vendorCategoriesResponse.json()
        setTotalVendorCategoryCount(vendorCategoriesData.categories?.length || 0)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

  const addToCart = async (productId: string) => {
    setAddingToCart(prev => new Set(prev).add(productId))
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantity: 1,
        }),
      })

      if (response.ok) {
        alert('Product added to cart!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add to cart')
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
      alert('Error adding to cart')
    } finally {
      setAddingToCart(prev => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    }
  }

  const filteredProducts = products.filter(product => {
    // Filter by product category
    if (selectedCategory && product.category?.id !== selectedCategory) {
      return false
    }
    // Filter by vendor category
    if (selectedVendorCategory && product.store?.categoryId !== selectedVendorCategory) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="text-center">
              <Skeleton className="h-10 w-48 mx-auto mb-4" />
              <Skeleton className="h-5 w-64 mx-auto" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[...Array(12)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-deep-navy to-royal-blue py-20 overflow-hidden">
         <div className="absolute inset-0">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
           <div className="absolute bottom-0 right-0 w-48 h-48 bg-premium-gold/10 rounded-full blur-2xl pointer-events-none"></div>
         </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-6">
              Premium Marketplace
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
              Discover Premium Products
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              Browse our curated selection of quality products from trusted vendors worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full rounded-full border border-white/20 bg-white/10 px-6 py-4 text-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm"
                />
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* View Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'products' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('products')}
              >
                Products
                <span className="ml-2 text-xs opacity-70">({totalProductCount})</span>
              </Button>
              <Button
                variant={viewMode === 'vendors' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('vendors')}
              >
                Vendors
                <span className="ml-2 text-xs opacity-70">({totalVendorCount})</span>
              </Button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === '' ? 'primary' : 'ghost'}
                size="sm"
                className={`rounded-full ${selectedCategory === '' ? '' : 'text-slate-700'}`}
                onClick={() => setSelectedCategory('')}
              >
                All Categories
                <span className="ml-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                  {totalProductCategoryCount}
                </span>
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'primary' : 'ghost'}
                  size="sm"
                  className={`rounded-full ${selectedCategory === category.id ? '' : 'text-slate-700'}`}
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                  <span className="ml-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    {products.filter(p => p.category?.id === category.id).length}
                  </span>
                </Button>
              ))}
            </div>

            {/* Vendor Category Filter */}
            {vendorCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-700">Vendor Type:</span>
                <Button
                    variant={selectedVendorCategory === '' ? 'primary' : 'ghost'}
                    size="sm"
                    className={`rounded-full ${selectedVendorCategory === '' ? '' : 'text-slate-700'}`}
                    onClick={() => setSelectedVendorCategory('')}
                  >
                    All
                    <span className="ml-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                      {totalVendorCategoryCount}
                    </span>
                  </Button>
                {vendorCategories.map((vc) => (
                    <Button
                      key={vc.id}
                      variant={selectedVendorCategory === vc.id ? 'primary' : 'ghost'}
                      size="sm"
                      className={`rounded-full ${selectedVendorCategory === vc.id ? '' : 'text-slate-700'}`}
                      onClick={() => setSelectedVendorCategory(vc.id)}
                    >
                      {vc.name}
                      <span className="ml-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                        {vendors.filter(v => v.category?.id === vc.id).length}
                      </span>
                    </Button>
                  ))}
              </div>
            )}
          </div>
        </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>{filteredProducts.length} products</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span>Verified sellers</span>
            </div>

          {/* Results */}
          {viewMode === 'products' ? (
            filteredProducts.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                title={selectedCategory ? 'No products in this category' : 'No products available'}
                description={selectedCategory ? 'Try selecting a different category or check back later.' : 'Check back later for new products from our vendors.'}
                actionLabel="Browse All Products"
                onAction={() => setSelectedCategory('')}
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {filteredProducts.map((product) => (
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
                            loading="lazy"
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
                        {product.store && (
                          <Badge
                            variant="verified"
                            size="sm"
                            className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5"
                          >
                            {product.store.name}
                          </Badge>
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
                      <div className="flex flex-col gap-1 pt-0.5">
                        <Button
                          size="sm"
                          className="w-full h-7 text-[11px] px-2 py-1 rounded-lg"
                          disabled={product.stock === 0 || addingToCart.has(product.id)}
                          onClick={() => addToCart(product.id)}
                        >
                          {addingToCart.has(product.id)
                            ? '...'
                            : product.stock > 0
                            ? 'Add to Cart'
                            : 'Out of Stock'}
                        </Button>
                        <Link href={`/marketplace/product/${product.id}`} className="w-full">
                          <Button variant="outline" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : (
            // Vendors View
            vendors.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                title="No vendors available"
                description="Check back later for new vendors joining our marketplace."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {vendors.map((vendor) => (
                  <Card
                    key={vendor.id}
                    variant="elevated"
                    className="group overflow-hidden cursor-pointer"
                  >
                    <Link href={`/vendor/${vendor.id}`} className="block">
                      <div className="relative h-40 bg-gradient-to-br from-deep-navy to-royal-blue overflow-hidden">
                        {vendor.logo ? (
                          <img
                            src={vendor.logo}
                            alt={`${vendor.name} logo`}
                            className="absolute inset-0 w-full h-full object-cover opacity-50"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl font-bold text-white opacity-30">
                              {vendor.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex gap-1">
                          {vendor.isFeatured && (
                            <Badge variant="premium" size="sm">
                              Featured
                            </Badge>
                          )}
                          {vendor.isVerified && (
                            <Badge variant="verified" size="sm">
                              Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="text-lg font-semibold text-deep-navy mb-1 group-hover:text-royal-blue transition-colors">
                          {vendor.name}
                        </h3>
                        {vendor.category && (
                          <p className="text-sm text-slate-500 mb-2">
                            {vendor.category.name}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-400">★</span>
                            <span className="font-medium">{vendor.rating}</span>
                          </div>
                          <span className="text-slate-500">
                            {vendor.productCount} products
                          </span>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>
            )
          )}
      </div>
    </div>
  )
}

export default function Marketplace() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-deep-navy mb-4">Loading marketplace...</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-8">
              {[...Array(12)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  )
}