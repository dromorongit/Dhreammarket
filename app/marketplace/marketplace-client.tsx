'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { MdVerified } from 'react-icons/md'
import { dispatchCartUpdate, handleAuthRedirect } from '@/lib/CartContext'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  flashSalePrice?: number | null
  salesPrice?: number | null
  dealsPrice?: number | null
  stock: number
  brand?: string | null
  brandId?: string | null
  brandRelation?: {
    id: string
    name: string
    slug: string
    logo?: string | null
  } | null
  category?: {
    id: string
    name: string
  }
  store?: {
    id: string
    name: string
    categoryId: string | null
    isVerified: boolean
    badgeTier: string | null
  }
  images?: Array<{
    id: string
    url: string
    alt: string | null
  }>
  availabilityType?: string
  expectedArrivalDate?: string | null
  estimatedFulfillmentDays?: number | null
  preOrderNotes?: string | null
  expectedRestockDate?: string | null
  backOrderNotes?: string | null
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
  slug: string | null
  name: string
  description: string | null
  isVerified: boolean
  isFeatured: boolean
  badgeTier: string | null
  logo: string | null
  rating: number
  productCount: number
  category: { id: string; name: string; slug: string } | null
}

function MarketplaceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vendorCategories, setVendorCategories] = useState<Category[]>([])
  const [totalProductCount, setTotalProductCount] = useState(0)
  const [totalProductCategoryCount, setTotalProductCategoryCount] = useState(0)
  const [totalVendorCount, setTotalVendorCount] = useState(0)
  const [totalVendorCategoryCount, setTotalVendorCategoryCount] = useState(0)
  const [productPagination, setProductPagination] = useState({ page: 1, limit: 50, totalPages: 0 })
  const [vendorPagination, setVendorPagination] = useState({ page: 1, limit: 20, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('')
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'products' | 'vendors'>('products')

  useEffect(() => {
    if (viewMode === 'products') {
      setSelectedVendorCategory('')
    } else {
      setSelectedCategory('')
    }
  }, [viewMode])

  useEffect(() => {
    fetchCategories()
    fetchVendorCategories()
    fetchCounts()
    fetchVendors()
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [productPagination.page])

  useEffect(() => {
    fetchVendors()
  }, [vendorPagination.page, selectedVendorCategory])

  useEffect(() => {
    setVendorPagination({ page: 1, limit: 20, totalPages: vendorPagination.totalPages })
  }, [selectedVendorCategory])

  useEffect(() => {
    setProductPagination({ page: 1, limit: 50, totalPages: productPagination.totalPages })
  }, [selectedCategory])

  useEffect(() => {
    const categoryParam = searchParams.get('category') ?? ''
    const vendorCategoryParam = searchParams.get('vendorCategory') ?? ''
    const brandParam = searchParams.get('brand') ?? ''
    setSelectedCategory(categoryParam)
    setSelectedBrand(brandParam)
    setSelectedVendorCategory(vendorCategoryParam)
  }, [searchParams])

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/products?page=${productPagination.page}&limit=${productPagination.limit}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
        setProductPagination(prev => ({ ...prev, totalPages: data.pagination?.totalPages ?? 0 }))
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
      const response = await fetch(`/api/vendors?page=${vendorPagination.page}&limit=${vendorPagination.limit}${selectedVendorCategory ? `&vendorCategoryId=${selectedVendorCategory}` : ''}`)
      if (response.ok) {
        const data = await response.json()
        const sortedVendors = data.vendors.sort((a: Vendor, b: Vendor) => {
          if (a.isFeatured && !b.isFeatured) return -1
          if (!a.isFeatured && b.isFeatured) return 1
          if (b.rating !== a.rating) return b.rating - a.rating
          return b.productCount - a.productCount
        })
        setVendors(sortedVendors)
        setVendorPagination(prev => ({ ...prev, totalPages: data.pagination?.totalPages ?? 0 }))
      }
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  const fetchCounts = async () => {
    try {
      const countResponse = await fetch('/api/products/count')
      let totalProducts = 0
      if (countResponse.ok) {
        const countData = await countResponse.json()
        totalProducts = countData.count ?? 0
      } else {
        const productsResponse = await fetch('/api/products?limit=1')
        if (productsResponse.ok) {
          const productsData = await productsResponse.json()
          totalProducts = productsData.pagination?.total ?? 0
        }
      }
      setTotalProductCount(totalProducts)

      const categoriesResponse = await fetch('/api/categories')
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        const countAllCategories = (cats: Category[]): number => {
          return cats.reduce((count, cat) => {
            return count + 1 + (cat.children ? countAllCategories(cat.children) : 0)
          }, 0)
        }
        setTotalProductCategoryCount(countAllCategories(categoriesData.categories ?? []))
      }

      const vendorsResponse = await fetch('/api/vendors?limit=1')
      if (vendorsResponse.ok) {
        const vendorsData = await vendorsResponse.json()
        setTotalVendorCount(vendorsData.pagination?.total ?? 0)
      }

      const vendorCategoriesResponse = await fetch('/api/vendor-categories')
      if (vendorCategoriesResponse.ok) {
        const vendorCategoriesData = await vendorCategoriesResponse.json()
        const totalVendorCats = vendorCategoriesData.categories?.reduce((sum: number, cat: { productCount?: number }) => sum + (cat.productCount ?? 0), 0) ?? 0
        setTotalVendorCategoryCount(totalVendorCats)
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

      if (response.status === 401) {
        handleAuthRedirect()
        return
      }

      if (response.ok) {
        dispatchCartUpdate()
        alert('Product added to cart!')
      } else {
        const error = await response.json()
        alert(error.error ?? 'Failed to add to cart')
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

  const getAllDescendantIds = (cats: Category[], parentId: string | null = null): string[] => {
    const result: string[] = []
    const findChildren = (parentId: string | null) => {
      const children = cats.filter(c => c.parentId === parentId)
      children.forEach(child => {
        result.push(child.id)
        findChildren(child.id)
      })
    }
    findChildren(parentId)
    return result
  }

  const getCategoryFilterIds = (categoryId: string): string[] => {
    const findCategoryAndChildren = (cats: Category[]): string[] => {
      for (const cat of cats) {
        if (cat.id === categoryId) {
          const allIds = [cat.id]
          const getChildrenIds = (children: Category[] | undefined) => {
            if (children) {
              for (const child of children) {
                allIds.push(child.id)
                getChildrenIds(child.children)
              }
            }
          }
          getChildrenIds(cat.children)
          return allIds
        }
        if (cat.children) {
          const found = findCategoryAndChildren(cat.children)
          if (found.length > 0) return found
        }
      }
      return []
    }
    return findCategoryAndChildren(categories)
  }

  const renderProductCategoryButtons = (cats: Category[]): React.ReactNode[] => {
    const parentCategories = cats.filter(cat => cat.parentId === null)

    return parentCategories.map((cat) => {
      const matchingIds = getCategoryFilterIds(cat.id)
      const productCount = products.filter(p =>
        matchingIds.includes(p.category?.id ?? '')
      ).length

      return (
        <Button
          key={cat.id}
          variant={selectedCategory === cat.id ? 'primary' : 'ghost'}
          size="sm"
          className={`rounded-2xl whitespace-nowrap min-h-[48px] px-6 py-3 font-semibold flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 snap-start ${selectedCategory === cat.id ? '' : 'text-slate-700'}`}
          onClick={() => setSelectedCategory(cat.id)}
        >
          {cat.name}
          <span className="ml-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
            {productCount}
          </span>
        </Button>
      )
    })
  }

  const renderVendorCategoryButtons = (cats: Category[]): React.ReactNode[] => {
    return cats.map((vc) => (
      <Button
        key={vc.id}
        variant={selectedVendorCategory === vc.id ? 'primary' : 'ghost'}
        size="sm"
        className={`rounded-2xl whitespace-nowrap min-h-[48px] px-6 py-3 font-semibold flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 snap-start ${selectedVendorCategory === vc.id ? '' : 'text-slate-700'}`}
        onClick={() => setSelectedVendorCategory(vc.id)}
      >
        {vc.name}
        <span className="ml-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
          {vc.productCount ?? vendors.filter(v => v.category?.id === vc.id).length}
        </span>
      </Button>
    ))
  }

  const filteredProducts = products.filter(product => {
    if (selectedBrand) {
      const filter = decodeURIComponent(selectedBrand).toLowerCase()
      const brandSlug = product.brandRelation?.slug?.toLowerCase()
      const brandName = product.brand?.toLowerCase()
      if (brandSlug !== filter && brandName !== filter) {
        return false
      }
    }
    if (selectedCategory) {
      const matchingIds = getCategoryFilterIds(selectedCategory)
      if (!matchingIds.includes(product.category?.id ?? '')) {
        return false
      }
    }
    return true
  })

  const filteredVendors = vendors

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
      <section className="relative bg-gradient-to-br from-deep-navy to-royal-blue py-20 overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          preload="metadata"
        >
          <source src="/assets/videos/marketplace.MOV" type="video/mp4" />
        </video>
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
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const input = (e.target as HTMLFormElement).querySelector('input') as HTMLInputElement
                  const searchQuery = input.value.trim()
                  if (searchQuery) {
                    router.push(`/search?q=${encodeURIComponent(searchQuery)}`)
                  }
                }}
                className="relative flex-1"
              >
                <input
                  type="text"
                  placeholder="Search products, vendors, categories, brands..."
                  className="w-full rounded-full border border-white/20 bg-white/10 px-6 py-4 text-base text-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm"
                />
                <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 hover:text-white transition-colors">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {viewMode === 'products' && (
              <div className="flex items-center gap-4 pb-2 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory">
                <Button
                  variant={selectedCategory === '' ? 'primary' : 'ghost'}
                  size="sm"
                  className={`rounded-2xl whitespace-nowrap min-h-[48px] px-6 py-3 font-semibold flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 snap-start ${selectedCategory === '' ? '' : 'text-slate-700'}`}
                  onClick={() => setSelectedCategory('')}
                >
                  All Categories
                  <span className="ml-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    {totalProductCategoryCount}
                  </span>
                </Button>
                {renderProductCategoryButtons(categories)}
              </div>
            )}

            {viewMode === 'vendors' && vendorCategories.length > 0 && (
              <div className="flex items-center gap-4 pb-2 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory">
                <span className="text-sm font-medium text-slate-700 flex-shrink-0">Vendor Type:</span>
                <Button
                  variant={selectedVendorCategory === '' ? 'primary' : 'ghost'}
                  size="sm"
                  className={`rounded-2xl whitespace-nowrap min-h-[48px] px-6 py-3 font-semibold flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 snap-start ${selectedVendorCategory === '' ? '' : 'text-slate-700'}`}
                  onClick={() => setSelectedVendorCategory('')}
                >
                  All
                  <span className="ml-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    {totalVendorCategoryCount}
                  </span>
                </Button>
                {renderVendorCategoryButtons(vendorCategories)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            {viewMode === 'products' ? (
              <>
                <span>{filteredProducts.length} products</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span>Verified sellers</span>
              </>
            ) : (
              <>
                <span>{filteredVendors.length} vendors</span>
                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                <span>Featured stores</span>
              </>
            )}
          </div>

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
                {filteredProducts.map((product) => {
                  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
                  const hasDiscount = (product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice) != null && product.price > effectivePrice
                  const discountPercentage = hasDiscount ? Math.round(((product.price - effectivePrice) / product.price) * 100) : 0
                  return (
                    <Card
                      key={product.id}
                      variant="elevated"
                      className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0"
                    >
                      <Link href={`/marketplace/product/${product.id}`} className="block">
                        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden -m-px">
                          {(product.images?.length ?? 0) > 0 ? (
                            <img
                              src={product.images![0].url}
                              alt={product.images![0].alt || product.name}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <ProductBadges product={calculateProductBadges({
                            price: product.price,
                            flashSalePrice: product.flashSalePrice,
                            salesPrice: product.salesPrice,
                            dealsPrice: product.dealsPrice,
                            stock: product.stock,
                            availabilityType: product.availabilityType,
                            expectedArrivalDate: product.expectedArrivalDate,
                            expectedRestockDate: product.expectedRestockDate,
                          })} />
                        </div>
                      </Link>
                      <div className="p-2 space-y-1 flex-1 flex flex-col">
                        <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-royal-blue">
                            {formatPrice(effectivePrice)}
                          </span>
                          {discountPercentage > 0 && (
                            <span className="text-[10px] text-slate-400 line-through">
                              {formatPrice(product.price)}
                            </span>
                          )}
                        </div>
                        {product.store && (
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="text-[10px] text-slate-500 truncate">
                              {product.store.name}
                            </p>
{(() => {
                               const badgeInfo = getVendorBadgeInfo(product.store?.badgeTier ?? null)
                               if (badgeInfo) {
                                const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                                return (
                                  <MdVerified className={`w-3 h-3 flex-shrink-0 inline-block ${iconColor}`} />
                                )
                              }
                              if (product.store.isVerified) {
                                return (
                                  <MdVerified className="w-3 h-3 text-sky-500 flex-shrink-0 inline-block" />
                                )
                              }
                              return null
                            })()}
                          </div>
                        )}
                        <div className="flex flex-col gap-1 pt-0.5">
                          <Button
                            size="sm"
                            className="w-full h-7 text-[11px] px-2 py-1 rounded-lg"
                            disabled={product.stock === 0 && product.availabilityType === 'IN_STOCK' || addingToCart.has(product.id)}
                            onClick={() => addToCart(product.id)}
                          >
                            {addingToCart.has(product.id)
                              ? '...'
                              : product.availabilityType === 'PREORDER'
                                ? 'Pre-order'
                                : product.availabilityType === 'BACKORDER'
                                  ? 'Backorder'
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
                  )
                })}
              </div>
            )
          ) : (
            filteredVendors.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
                title={selectedVendorCategory ? 'No vendors in this category' : 'No vendors available'}
                description={selectedVendorCategory ? 'Try selecting a different vendor category or check back later.' : 'Check back later for new vendors joining our marketplace.'}
                actionLabel="Browse All Vendors"
                onAction={() => setSelectedVendorCategory('')}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVendors.map((vendor) => (
                  <Card
                    key={vendor.id}
                    variant="elevated"
                    className="group overflow-hidden cursor-pointer"
                  >
                    <Link href={`/vendor/${vendor.slug ?? vendor.id}`} className="block">
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
                        {vendor.isFeatured && (
                          <div className="absolute top-3 left-3">
                            <Badge variant="premium" size="sm">
                              Featured
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <h3 className="text-lg font-semibold text-deep-navy mb-1 group-hover:text-royal-blue transition-colors min-w-0 overflow-hidden text-ellipsis line-clamp-1">
                            {truncateVendorName(vendor.name)}
                          </h3>
{(() => {
                             const badgeInfo = getVendorBadgeInfo(vendor.badgeTier)
                             if (badgeInfo) {
                              const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                              return (
                                <MdVerified className={`w-4 h-4 ${iconColor} flex-shrink-0`} />
                              )
                            }
                            if (vendor.isVerified) {
                              return (
                                <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0" />
                              )
                            }
                            return null
                          })()}
                        </div>
                        {vendor.category && (
                          <p className="text-sm text-slate-500 mb-2 min-w-0 overflow-hidden text-ellipsis line-clamp-1">
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

          {viewMode === 'products' && productPagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t pt-6">
              <div className="text-sm text-slate-600">
                Page {productPagination.page} of {productPagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setProductPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={productPagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                >
                  Previous
                </button>
                <button
                  onClick={() => setProductPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={productPagination.page >= productPagination.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {viewMode === 'vendors' && vendorPagination.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t pt-6">
              <div className="text-sm text-slate-600">
                Page {vendorPagination.page} of {vendorPagination.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setVendorPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={vendorPagination.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                >
                  Previous
                </button>
                <button
                  onClick={() => setVendorPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={vendorPagination.page >= vendorPagination.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
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