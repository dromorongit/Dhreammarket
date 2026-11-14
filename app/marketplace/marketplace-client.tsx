'use client'

import Image from 'next/image'
import { useState, useEffect, Suspense, memo, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'
import { MdStore, MdVerified } from 'react-icons/md'
import { FaChevronDown, FaEye, FaShoppingCart } from 'react-icons/fa'
import { dispatchCartUpdate, handleAuthRedirect, logCartRequest } from '@/lib/CartContext'
import { event } from '@/lib/gtag'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges'
import { ProductStockIndicator } from '@/components/ProductStockIndicator'
import ServiceCard from '@/components/ServiceCard'
import WishlistButton from '@/components/WishlistButton'
import NonReturnableBadge from '@/components/NonReturnableBadge'
import { AIRecommendations } from '@/components/ai'
import { AITrending } from '@/components/ai'
import { getBlurDataURL, CARD_IMAGE_SIZES, CARD_IMAGE_SIZES_4COL, CARD_IMAGE_SIZES_6COL, VENDOR_LOGO_SIZES } from '@/lib/image-utils'
import WhatsAppFloatButton from '@/components/WhatsAppFloatButton'
import DhreamSellerBadge from '@/components/DhreamSellerBadge'
import MarketplaceHero from '@/components/marketplace/MarketplaceHero'
import { FiltersBackdrop } from '@/components/marketplace/FiltersBackdrop'
import { ChipsScrollRow } from '@/components/marketplace/ChipsScrollRow'

interface Product {
  id: string
  slug?: string
  name: string
  description: string | null
  price: number
  flashSalePrice?: number | null
  salesPrice?: number | null
  dealsPrice?: number | null
  stock: number
  reservedQuantity?: number | null
  isSponsored?: boolean
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
  isReturnable?: boolean
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

interface Service {
  id: string
  slug: string
  title: string
  shortDescription: string | null
  startingPrice: number
  pricingType: string
  deliveryType: string
  availabilityStatus: string
  status: string
  thumbnail: string | null
  gallery: string[]
  category: {
    id: string
    name: string
    slug: string
  }
  store: {
    id: string
    name: string
    slug: string
    isVerified: boolean
    badgeTier: string | null
    averageRating: number
    reviewCount: number
    logo: string | null
  }
  images: Array<{
    id: string
    imageUrl: string
    displayOrder: number
  }>
  tags: string[]
  estimatedDeliveryTime: string | null
  requirementsFromCustomer?: string | null
}

interface ServiceCategory {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  isFeatured: boolean
  serviceCount?: number
}

const MarketplaceProductCard = memo(function MarketplaceProductCard({
  product,
  isWishlisted,
  isAdding,
  onAddToCart,
}: {
  product: Product
  isWishlisted: boolean
  isAdding: boolean
  onAddToCart: (id: string, name?: string, price?: number) => void
}) {
  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
  const hasDiscount = (product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice) != null && product.price > effectivePrice
  const discountPercentage = hasDiscount ? Math.round(((product.price - effectivePrice) / product.price) * 100) : 0

  return (
    <Card
      variant="default"
      className="flex flex-col h-full bg-white border-none rounded-[22px] shadow-[0_8px_24px_rgba(15,35,80,0.08)] p-3 sm:p-3.5 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
    >
      <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden rounded-[16px] -m-px">
          <WishlistButton
            productId={product.id}
            initialIsWishlisted={isWishlisted}
            size="sm"
            className="absolute top-2 right-2 z-10 w-9 h-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:ring-offset-2"
          />
          {(product.images?.length ?? 0) > 0 ? (
            <Image
              src={getOptimizedCloudinaryUrl(product.images![0].url, 400)}
              alt={product.images![0].alt || product.name}
              className="absolute inset-0 w-full h-full object-cover rounded-[16px] group-hover:scale-105 transition-transform duration-500"
              fill
              loading="lazy"
              sizes={CARD_IMAGE_SIZES_6COL}
              placeholder="blur"
              blurDataURL={getBlurDataURL()}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-[16px]">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
            <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="inline-flex items-center justify-center bg-black/70 hover:bg-black/80 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors">
              Quick View
            </Link>
          </div>
          <ProductBadges product={calculateProductBadges({
            price: product.price,
            flashSalePrice: product.flashSalePrice,
            salesPrice: product.salesPrice,
            dealsPrice: product.dealsPrice,
            stock: product.stock,
            reservedQuantity: product.reservedQuantity,
            availabilityType: product.availabilityType,
            expectedArrivalDate: product.expectedArrivalDate,
            expectedRestockDate: product.expectedRestockDate,
            isSponsored: (product as any).isSponsored,
          })} />
        </div>
      </Link>
      <div className="flex-1 flex flex-col space-y-1">
        <h3 className="text-[0.9rem] sm:text-sm font-bold text-deep-navy line-clamp-2 leading-tight">
          {product.name}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-[#0B5CFF]">
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
            <MdStore className="w-3 h-3 flex-shrink-0 text-deep-navy" />
            <p className="text-[10px] font-medium text-deep-navy truncate">
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
      </div>
      <div className="mt-auto flex flex-col gap-2 w-full">
        <Button
          size="sm"
          variant="primary"
          className="w-full h-10 sm:h-[44px] rounded-full text-xs px-3 py-1 focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          disabled={((product.stock - (product.reservedQuantity || 0)) <= 0 && product.availabilityType === 'IN_STOCK') || isAdding}
          onClick={() => onAddToCart(product.id, product.name, product.price)}
        >
          <FaShoppingCart className="w-4 h-4 mr-1.5" />
          {isAdding
            ? '...'
            : product.availabilityType === 'PREORDER'
              ? 'Pre-order'
              : product.availabilityType === 'BACKORDER'
                ? 'Backorder'
                : product.stock > 0
                  ? 'Add to Cart'
                  : 'Out of Stock'}
        </Button>
        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="w-full">
          <Button variant="outline" size="sm" className="w-full h-10 sm:h-[44px] rounded-full text-xs px-3 py-1 text-deep-navy border-deep-navy/50 focus:ring-0 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:ring-offset-2 disabled:cursor-not-allowed">
            <FaEye className="w-4 h-4 mr-1.5" />
            View Details
          </Button>
        </Link>
        <ProductStockIndicator stock={product.stock} reservedQuantity={product.reservedQuantity} availabilityType={product.availabilityType} />
        <NonReturnableBadge isReturnable={product.isReturnable} compact />
      </div>
    </Card>
  )
})

function MarketplaceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedVendorCategory, setSelectedVendorCategory] = useState<string>('')
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [productSortBy, setProductSortBy] = useState('newest')
  const [productMinPrice, setProductMinPrice] = useState('')
  const [productMaxPrice, setProductMaxPrice] = useState('')
  const [productAvailabilityType, setProductAvailabilityType] = useState('')
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'products' | 'services' | 'vendors'>('products')
  const [productPagination, setProductPagination] = useState({ page: 1, limit: 50, totalPages: 0 })
  const [vendorPagination, setVendorPagination] = useState({ page: 1, limit: 20, totalPages: 0 })
  const [servicePagination, setServicePagination] = useState({ page: 1, limit: 12, totalPages: 0 })
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('')
  const [serviceSortBy, setServiceSortBy] = useState('newest')
  const [serviceMinPrice, setServiceMinPrice] = useState('')
  const [serviceMaxPrice, setServiceMaxPrice] = useState('')
  const [serviceSearchQuery, setServiceSearchQuery] = useState('')

  useEffect(() => {
    if (viewMode === 'products') {
      setSelectedVendorCategory('')
    } else if (viewMode === 'vendors') {
      setSelectedCategory('')
    } else {
      setSelectedCategory('')
      setSelectedVendorCategory('')
    }
  }, [viewMode])

  const { data: productsData, isPending: productsPending } = useQuery({
    queryKey: ['products', 'marketplace', productPagination.page, productPagination.limit, selectedCategory, selectedBrand, productSortBy, productMinPrice, productMaxPrice, productAvailabilityType],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        params.set('page', String(productPagination.page))
        params.set('limit', String(productPagination.limit))
        params.set('sortBy', productSortBy === 'newest' ? 'createdAt' : productSortBy === 'price-low' ? 'price' : productSortBy === 'price-high' ? 'price' : productSortBy === 'best-selling' ? 'salesCount' : productSortBy === 'top-rated' ? 'averageRating' : 'createdAt')
        params.set('sortOrder', productSortBy === 'price-high' || productSortBy === 'price-low' ? 'asc' : 'desc')
        if (selectedCategory) params.set('categoryId', selectedCategory)
        if (selectedBrand) params.set('brandSlug', decodeURIComponent(selectedBrand))
        if (productMinPrice) params.set('minPrice', productMinPrice)
        if (productMaxPrice) params.set('maxPrice', productMaxPrice)
        if (productAvailabilityType) params.set('availabilityType', productAvailabilityType)
        const response = await fetch(`/api/products?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch products')
        return response.json()
      } catch (error) {
        console.error('Error fetching products:', error)
        throw error
      }
    },
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/categories')
        if (!response.ok) throw new Error('Failed to fetch categories')
        return response.json()
      } catch (error) {
        console.error('Error fetching categories:', error)
        throw error
      }
    },
  })

  const { data: vendorCategoriesData } = useQuery({
    queryKey: ['vendor-categories'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/vendor-categories')
        if (!response.ok) throw new Error('Failed to fetch vendor categories')
        return response.json()
      } catch (error) {
        console.error('Error fetching vendor categories:', error)
        throw error
      }
    },
  })

  const { data: serviceCategoriesData } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/service-categories')
        if (!response.ok) throw new Error('Failed to fetch service categories')
        return response.json()
      } catch (error) {
        console.error('Error fetching service categories:', error)
        throw error
      }
    },
  })

  const { data: servicesData, isPending: servicesPending } = useQuery({
    queryKey: ['services', 'marketplace', servicePagination.page, servicePagination.limit, selectedServiceCategory, serviceSortBy, serviceMinPrice, serviceMaxPrice, serviceSearchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        params.set('page', String(servicePagination.page))
        params.set('limit', String(servicePagination.limit))
        params.set('sortBy', serviceSortBy === 'newest' ? 'createdAt' : serviceSortBy === 'price-low' ? 'startingPrice' : serviceSortBy === 'price-high' ? 'startingPrice' : serviceSortBy === 'alphabetical' ? 'alphabetical' : serviceSortBy === 'featured' ? 'featured' : 'createdAt')
        params.set('sortOrder', serviceSortBy === 'price-high' || serviceSortBy === 'price-low' || serviceSortBy === 'alphabetical' ? 'asc' : 'desc')
        if (selectedServiceCategory) params.set('categoryId', selectedServiceCategory)
        if (serviceMinPrice) params.set('minPrice', serviceMinPrice)
        if (serviceMaxPrice) params.set('maxPrice', serviceMaxPrice)
        if (serviceSearchQuery) params.set('search', serviceSearchQuery)
        const response = await fetch(`/api/services?${params.toString()}`)
        if (!response.ok) throw new Error('Failed to fetch services')
        return response.json()
      } catch (error) {
        console.error('Error fetching services:', error)
        throw error
      }
    },
  })

  const { data: servicesCountData } = useQuery({
    queryKey: ['services', 'count', selectedServiceCategory, serviceMinPrice, serviceMaxPrice, serviceSearchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (selectedServiceCategory) params.set('categoryId', selectedServiceCategory)
        if (serviceMinPrice) params.set('minPrice', serviceMinPrice)
        if (serviceMaxPrice) params.set('maxPrice', serviceMaxPrice)
        if (serviceSearchQuery) params.set('search', serviceSearchQuery)
        const countResponse = await fetch(`/api/services?${params.toString()}&limit=1`)
        if (countResponse.ok) {
          const countData = await countResponse.json()
          return countData.pagination?.total ?? 0
        }
        return 0
      } catch (error) {
        console.error('Error fetching services count:', error)
        return 0
      }
    },
  })

  const { data: productsCountData } = useQuery({
    queryKey: ['products', 'count', selectedCategory, selectedBrand, productMinPrice, productMaxPrice, productAvailabilityType],
    queryFn: async () => {
      try {
        const params = new URLSearchParams()
        if (selectedCategory) params.set('categoryId', selectedCategory)
        if (selectedBrand) params.set('brandSlug', decodeURIComponent(selectedBrand))
        if (productMinPrice) params.set('minPrice', productMinPrice)
        if (productMaxPrice) params.set('maxPrice', productMaxPrice)
        if (productAvailabilityType) params.set('availabilityType', productAvailabilityType)
        const countResponse = await fetch(`/api/products/count?${params.toString()}`)
        if (countResponse.ok) {
          const countData = await countResponse.json()
          return countData.count ?? 0
        }
        const productsResponse = await fetch(`/api/products?limit=1&${params.toString()}`)
        if (productsResponse.ok) {
          const productsData = await productsResponse.json()
          return productsData.pagination?.total ?? 0
        }
        return 0
      } catch (error) {
        console.error('Error fetching product count:', error)
        throw error
      }
    },
  })

  const { data: vendorsData, isPending: vendorsPending } = useQuery({
    queryKey: ['vendors', 'marketplace', vendorPagination.page, vendorPagination.limit, selectedVendorCategory],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/vendors?page=${vendorPagination.page}&limit=${vendorPagination.limit}${selectedVendorCategory ? `&vendorCategoryId=${selectedVendorCategory}` : ''}`)
        if (!response.ok) throw new Error('Failed to fetch vendors')
        return response.json()
      } catch (error) {
        console.error('Error fetching vendors:', error)
        throw error
      }
    },
  })

  const productIdsForWishlist = productsData?.products?.map((p: any) => p.id).join(',') ?? ''


  const { data: wishlistData } = useQuery({
    queryKey: ['wishlist', 'status', productIdsForWishlist],
    queryFn: async () => {
      if (!productIdsForWishlist) return []
      try {
        const response = await fetch(`/api/wishlist/check?productIds=${productIdsForWishlist}`)
        if (!response.ok) throw new Error('Failed to fetch wishlist status')
        const data = await response.json()
        return data.productIds ?? []
      } catch (error) {
        console.error('Error fetching wishlist status:', error)
        throw error
      }
    },
    enabled: productIdsForWishlist.length > 0,
  })

  const products = (productsData?.products ?? []) as Product[]
  const vendors = (vendorsData?.vendors ?? []) as Vendor[]
  const categories = (categoriesData?.categories ?? []) as Category[]
  const vendorCategories = (vendorCategoriesData?.categories ?? []) as Category[]
  const totalProductCount = productsCountData ?? productsData?.pagination?.total ?? 0
  const totalVendorCount = vendorsData?.pagination?.total ?? 0
  const services = (servicesData?.services ?? []) as Service[]
  const totalServiceCount = servicesCountData ?? servicesData?.pagination?.total ?? 0
  const serviceCategories = (serviceCategoriesData?.categories ?? []) as ServiceCategory[]

  const { data: sponsoredPlacementsData } = useQuery({
    queryKey: ['sponsored', 'marketplace'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/sponsored/placements')
        if (!response.ok) return []
        const data = await response.json()
        return data.productIds ?? []
      } catch (e) {
        console.error('[Marketplace] Sponsored placements fetch failed:', e)
        return []
      }
    },
  })

  const sponsoredProductIds = new Set(sponsoredPlacementsData ?? [])
  const sortedProducts = useMemo(() => {
    if (sponsoredProductIds.size === 0) return products
    const sponsored = products.filter(p => sponsoredProductIds.has(p.id))
    const nonSponsored = products.filter(p => !sponsoredProductIds.has(p.id))
    return [...sponsored, ...nonSponsored]
  }, [products, sponsoredProductIds])
  const countAllCategories = (cats: Category[]): number => {
    return cats.reduce((sum: number, cat: Category) => {
      return sum + 1 + (cat.children ? countAllCategories(cat.children) : 0)
    }, 0)
  }

  const totalProductCategoryCount = countAllCategories(categories)
  const totalVendorCategoryCount = vendorCategories.reduce((sum: number, cat: Category) => sum + (cat.productCount ?? 0), 0)
  const totalServiceCategoryCount = serviceCategories.reduce((sum: number, cat: ServiceCategory) => sum + (cat.serviceCount ?? 0), 0)
  const wishlistedProductIds = new Set(wishlistData ?? [])

  useEffect(() => {
    setVendorPagination({ page: 1, limit: 20, totalPages: vendorPagination.totalPages })
  }, [selectedVendorCategory])

  useEffect(() => {
    setProductPagination({ page: 1, limit: 50, totalPages: productPagination.totalPages })
  }, [selectedCategory, selectedBrand, productSortBy, productMinPrice, productMaxPrice, productAvailabilityType])

  useEffect(() => {
    setServicePagination({ page: 1, limit: 12, totalPages: servicePagination.totalPages })
  }, [selectedServiceCategory, serviceSortBy, serviceMinPrice, serviceMaxPrice, serviceSearchQuery])

  useEffect(() => {
    setProductPagination(prev => ({ ...prev, totalPages: totalProductCount > 0 ? Math.ceil(totalProductCount / prev.limit) : 0 }))
  }, [totalProductCount])

  useEffect(() => {
    setVendorPagination(prev => ({ ...prev, totalPages: totalVendorCount > 0 ? Math.ceil(totalVendorCount / prev.limit) : 0 }))
  }, [totalVendorCount])

  useEffect(() => {
    setServicePagination(prev => ({ ...prev, totalPages: totalServiceCount > 0 ? Math.ceil(totalServiceCount / prev.limit) : 0 }))
  }, [totalServiceCount])

  const isInternalNavigation = useRef(false)

  useEffect(() => {
    if (isInternalNavigation.current) {
      isInternalNavigation.current = false
      return
    }
    const categoryParam = searchParams?.get('category') ?? ''
    const vendorCategoryParam = searchParams?.get('vendorCategory') ?? ''
    const brandParam = searchParams?.get('brand') ?? ''
    const viewModeParam = searchParams?.get('viewMode') ?? ''
    const serviceCategoryParam = searchParams?.get('serviceCategory') ?? ''
    const productSortParam = searchParams?.get('sort') ?? ''
    const productMinPriceParam = searchParams?.get('minPrice') ?? ''
    const productMaxPriceParam = searchParams?.get('maxPrice') ?? ''
    const productAvailabilityParam = searchParams?.get('availability') ?? ''
    setSelectedCategory(categoryParam)
    setSelectedBrand(brandParam)
    setSelectedVendorCategory(vendorCategoryParam)
    if (viewModeParam === 'services' || viewModeParam === 'vendors') {
      setViewMode(viewModeParam)
    }
    if (serviceCategoryParam) {
      setSelectedServiceCategory(serviceCategoryParam)
    }
    if (productSortParam) {
      setProductSortBy(productSortParam)
    }
    if (productMinPriceParam) {
      setProductMinPrice(productMinPriceParam)
    }
    if (productMaxPriceParam) {
      setProductMaxPrice(productMaxPriceParam)
    }
    if (productAvailabilityParam) {
      setProductAvailabilityType(productAvailabilityParam)
    }
  }, [searchParams])

  const addToCart = useCallback(async (productId: string, productName?: string, productPrice?: number) => {
    setAddingToCart(prev => new Set(prev).add(productId))
    try {
      logCartRequest('POST /api/cart (marketplace-client addToCart)')
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
        if (productName !== undefined && productPrice !== undefined) {
          event({ action: 'add_to_cart', category: 'ecommerce', label: productName, value: productPrice })
        }
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
  }, [])

  const syncFilterToUrl = useCallback((key: string, value: string) => {
    isInternalNavigation.current = true
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.replace(`/marketplace?${params.toString()}`)
  }, [router, searchParams])

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
      const selected = selectedCategory === cat.id

      return (
        <Button
          key={cat.id}
          variant="ghost"
          size="sm"
          className={`rounded-[28px] whitespace-nowrap min-h-[52px] px-6 py-3 flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] snap-start items-center ${selected ? 'bg-gradient-to-r from-[#0B5CFF] to-[#0A3FB8] text-white' : 'bg-white text-deep-navy shadow-sm'}`}
          onClick={() => { setSelectedCategory(cat.id); syncFilterToUrl('category', cat.id) }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="font-bold">{cat.name}</span>
            {selected ? (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{productCount}</span>
            ) : (
              <span className="text-xs text-slate-500">{productCount}</span>
            )}
          </div>
        </Button>
      )
    })
  }

  const renderVendorCategoryButtons = (cats: Category[]): React.ReactNode[] => {
    return cats.map((vc) => {
      const selected = selectedVendorCategory === vc.id
      const count = vc.productCount ?? vendors.filter(v => v.category?.id === vc.id).length

      return (
        <Button
          key={vc.id}
          variant="ghost"
          size="sm"
          className={`rounded-[28px] whitespace-nowrap min-h-[52px] px-6 py-3 flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] snap-start items-center ${selected ? 'bg-gradient-to-r from-[#0B5CFF] to-[#0A3FB8] text-white' : 'bg-white text-deep-navy shadow-sm'}`}
          onClick={() => { setSelectedVendorCategory(vc.id); syncFilterToUrl('vendorCategory', vc.id) }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="font-bold">{vc.name}</span>
            {selected ? (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{count}</span>
            ) : (
              <span className="text-xs text-slate-500">{count}</span>
            )}
          </div>
        </Button>
      )
    })
  }

  const renderServiceCategoryButtons = (cats: ServiceCategory[]): React.ReactNode[] => {
    return cats.map((cat) => {
      const selected = selectedServiceCategory === cat.id

      return (
        <Button
          key={cat.id}
          variant="ghost"
          size="sm"
          className={`rounded-[28px] whitespace-nowrap min-h-[52px] px-6 py-3 flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] snap-start items-center ${selected ? 'bg-gradient-to-r from-[#0B5CFF] to-[#0A3FB8] text-white' : 'bg-white text-deep-navy shadow-sm'}`}
          onClick={() => { setSelectedServiceCategory(cat.id); syncFilterToUrl('serviceCategory', cat.id) }}
        >
          <div className="flex flex-col items-center gap-1">
            <span className="font-bold">{cat.name}</span>
            {selected ? (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{cat.serviceCount ?? 0}</span>
            ) : (
              <span className="text-xs text-slate-500">{cat.serviceCount ?? 0}</span>
            )}
          </div>
        </Button>
      )
    })
  }

  const filteredVendors = vendors

  if (productsPending) {
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
      <MarketplaceHero />

      <AIRecommendations
        title="Recommended for You"
        subtitle="Personalized picks based on your browsing and purchase history"
        recommendationType="RECOMMENDED_FOR_YOU"
        limit={8}
        layout="grid"
      />

      <AITrending
        title="Trending Now"
        subtitle="What&apos;s hot right now across the marketplace"
        timeWindow="24H"
        entityType="PRODUCT"
        limit={8}
        layout="grid"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="relative isolate overflow-hidden pl-6 pb-8 bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF4FF_100%)]">
          <FiltersBackdrop />

          <div className="relative z-10 pt-6 space-y-8">
            <div className="flex items-center justify-between">
              <ChipsScrollRow showArrows={false}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] ${viewMode === 'products' ? 'bg-gradient-to-r from-[#0B5CFF] to-[#0A3FB8] text-white' : 'bg-white text-deep-navy shadow-sm'}`}
                  onClick={() => setViewMode('products')}
                >
                  Products
                  <span className={`ml-2 text-xs ${viewMode === 'products' ? 'opacity-100' : 'text-slate-500 opacity-90'}`}>({totalProductCount})</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] ${viewMode === 'services' ? 'bg-gradient-to-r from-[#0B5CFF] to-[#0A3FB8] text-white' : 'bg-white text-deep-navy shadow-sm'}`}
                  onClick={() => setViewMode('services')}
                >
                  Services
                  <span className={`ml-2 text-xs ${viewMode === 'services' ? 'opacity-100' : 'text-slate-500 opacity-90'}`}>({totalServiceCount})</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] ${viewMode === 'vendors' ? 'bg-gradient-to-r from-[#0B5CFF] to-[#0A3FB8] text-white' : 'bg-white text-deep-navy shadow-sm'}`}
                  onClick={() => setViewMode('vendors')}
                >
                  Vendors
                  <span className={`ml-2 text-xs ${viewMode === 'vendors' ? 'opacity-100' : 'text-slate-500 opacity-90'}`}>({totalVendorCount})</span>
                </Button>
              </ChipsScrollRow>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-24">
            <div>
              {viewMode === 'products' && (
                <ChipsScrollRow>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-[28px] whitespace-nowrap min-h-[52px] px-6 py-3 flex-shrink-0 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5CFF] snap-start items-center ${selectedCategory === '' ? 'bg-gradient-to-r from-[#0B5CFF] to-[#0A3FB8] text-white' : 'bg-white text-deep-navy shadow-sm'}`}
                    onClick={() => { setSelectedCategory(''); syncFilterToUrl('category', '') }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold">All Categories</span>
                      {selectedCategory === '' ? (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{totalProductCategoryCount}</span>
                      ) : (
                        <span className="text-xs text-slate-500">{totalProductCategoryCount}</span>
                      )}
                    </div>
                  </Button>
                  {renderProductCategoryButtons(categories)}
                </ChipsScrollRow>
              )}

              {viewMode === 'vendors' && vendorCategories.length > 0 && (
                <ChipsScrollRow>
                  <span className="text-sm font-bold text-deep-navy flex-shrink-0">Vendor Type:</span>
                  {renderVendorCategoryButtons(vendorCategories)}
                </ChipsScrollRow>
              )}

              {viewMode === 'services' && (
                <ChipsScrollRow>
                  {renderServiceCategoryButtons(serviceCategories)}
                </ChipsScrollRow>
              )}
            </div>

            {viewMode === 'products' && (
              <div className="pr-4">
                <div className="flex gap-3 flex-wrap lg:grid lg:grid-cols-2 lg:gap-3">
                  <div className="relative group flex-1 min-w-[150px]">
                    <select
                      value={productSortBy}
                      onChange={(e) => { setProductSortBy(e.target.value); syncFilterToUrl('sort', e.target.value) }}
                      className="appearance-none w-full h-[52px] rounded-[22px] border border-slate-200 bg-white px-4 pr-10 text-deep-navy text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] cursor-pointer"
                    >
                      <option value="newest">Newest</option>
                      <option value="price-low">Price: Low to High</option>
                      <option value="price-high">Price: High to Low</option>
                      <option value="best-selling">Best Selling</option>
                      <option value="top-rated">Top Rated</option>
                    </select>
                    <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-navy/60 pointer-events-none" />
                  </div>
                  <div className="relative group flex-1 min-w-[150px]">
                    <input
                      type="number"
                      placeholder="Min price"
                      value={productMinPrice}
                      onChange={(e) => { setProductMinPrice(e.target.value); syncFilterToUrl('minPrice', e.target.value) }}
                      className="w-full h-[52px] rounded-[22px] border border-slate-200 bg-white px-4 text-deep-navy text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF]"
                    />
                  </div>
                  <div className="relative group flex-1 min-w-[150px]">
                    <input
                      type="number"
                      placeholder="Max price"
                      value={productMaxPrice}
                      onChange={(e) => { setProductMaxPrice(e.target.value); syncFilterToUrl('maxPrice', e.target.value) }}
                      className="w-full h-[52px] rounded-[22px] border border-slate-200 bg-white px-4 text-deep-navy text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF]"
                    />
                  </div>
                  <div className="relative group flex-1 min-w-[150px]">
                    <select
                      value={productAvailabilityType}
                      onChange={(e) => { setProductAvailabilityType(e.target.value); syncFilterToUrl('availability', e.target.value) }}
                      className="appearance-none w-full h-[52px] rounded-[22px] border border-slate-200 bg-white px-4 pr-10 text-deep-navy text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] cursor-pointer"
                    >
                      <option value="">All Availability</option>
                      <option value="IN_STOCK">In Stock</option>
                      <option value="PREORDER">Pre-order</option>
                      <option value="BACKORDER">Backorder</option>
                    </select>
                    <FaChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-deep-navy/60 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-deep-navy">
          {viewMode === 'products' ? (
            <>
              <span>{sortedProducts.length} products</span>
                <span className="w-1 h-1 rounded-full bg-[#64748b]"></span>
                <span className="font-semibold">Verified sellers</span>
              </>
            ) : viewMode === 'services' ? (
              <>
                <span>{services.length} services</span>
                <span className="w-1 h-1 rounded-full bg-[#64748b]"></span>
                <span className="font-semibold">Verified vendors</span>
              </>
            ) : (
              <>
                <span>{filteredVendors.length} vendors</span>
                <span className="w-1 h-1 rounded-full bg-[#64748b]"></span>
                <span className="font-semibold">Featured stores</span>
              </>
            )}
          </div>
          </div>
      </div>
      </div>

          <div className="pt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {viewMode === 'products' ? (
            sortedProducts.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                }
                title={selectedCategory ? 'No products in this category' : 'No products available'}
                description={selectedCategory ? 'Try selecting a different category or check back later.' : 'Check back later for new products from our vendors.'}
                actionLabel="Browse All Products"
                onAction={() => { setSelectedCategory(''); syncFilterToUrl('category', '') }}
              />
            ) : (
              <div id="products" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" style={{ scrollMarginTop: '80px' }}>
                {sortedProducts.map((product) => (
                  <MarketplaceProductCard
                    key={product.id}
                    product={product}
                    isWishlisted={wishlistedProductIds.has(product.id)}
                    isAdding={addingToCart.has(product.id)}
                    onAddToCart={addToCart}
                  />
                ))}
              </div>
            )
          ) : viewMode === 'vendors' ? (
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
                          <Image
                            src={getOptimizedCloudinaryUrl(vendor.logo, 80)}
                            alt={`${vendor.name} logo`}
                            className="absolute inset-0 w-full h-full object-cover opacity-50"
                            fill
                            sizes={VENDOR_LOGO_SIZES}
                            placeholder="blur"
                            blurDataURL={getBlurDataURL()}
                           unoptimized />
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
                        <div className="mb-1">
                          <DhreamSellerBadge className="h-6 w-auto max-w-none" />
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <h3 className="text-lg font-semibold text-deep-navy mb-1 group-hover:text-royal-blue transition-colors min-w-0 overflow-hidden text-ellipsis line-clamp-1">
                            {truncateVendorName(vendor.name)}
                          </h3>
                          {(() => {
                            const badgeInfo = getVendorBadgeInfo(vendor.badgeTier)
                            if (badgeInfo && vendor.isVerified) {
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
          ) : null}

          {viewMode === 'services' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 flex items-center gap-3 border-b border-slate-100">
                <input
                  type="text"
                  placeholder="Search services..."
                  value={serviceSearchQuery}
                  onChange={(e) => { setServiceSearchQuery(e.target.value); syncFilterToUrl('search', e.target.value) }}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
                />
                 <select value={serviceSortBy} onChange={(e) => { setServiceSortBy(e.target.value); syncFilterToUrl('serviceSort', e.target.value) }} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-royal-blue/50">
                   <option value="newest">Newest</option>
                   <option value="price-low">Price: Low to High</option>
                   <option value="price-high">Price: High to Low</option>
                   <option value="alphabetical">Alphabetical</option>
                   <option value="featured">Featured</option>
                 </select>
               </div>
               
               {servicesPending ? (
                 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                   {[...Array(6)].map((_, i) => (
                     <SkeletonCard key={i} />
                   ))}
                 </div>
               ) : services.length === 0 ? (
                 <div className="p-12">
                   <EmptyState
                     icon={
                       <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                       </svg>
                     }
                     title="No services found"
                     description="Try adjusting your filters or search query."
                      actionLabel="Clear Filters"
                      onAction={() => { setSelectedServiceCategory(''); setServiceSearchQuery(''); setServiceMinPrice(''); setServiceMaxPrice(''); setServiceSortBy('newest'); syncFilterToUrl('serviceCategory', ''); syncFilterToUrl('search', ''); syncFilterToUrl('serviceSort', 'newest'); }}
                   />
                 </div>
               ) : (
                 <>
                   <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
                     {services.map((service) => (
                       <ServiceCard key={service.id} service={service} wishlistServiceIds={wishlistedProductIds as Set<string>} />
                     ))}
                   </div>

                   {servicePagination.totalPages > 1 && (
                     <div className="flex items-center justify-between border-t pt-6 px-4">
                       <div className="text-sm text-slate-600">
                         Page {servicePagination.page} of {servicePagination.totalPages}
                       </div>
                       <div className="flex gap-2">
                         <button
                           onClick={() => setServicePagination(prev => ({ ...prev, page: prev.page - 1 }))}
                           disabled={servicePagination.page === 1}
                           className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                         >
                           Previous
                         </button>
                         <button
                           onClick={() => setServicePagination(prev => ({ ...prev, page: prev.page + 1 }))}
                           disabled={servicePagination.page >= servicePagination.totalPages}
                           className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 min-h-[44px]"
                         >
                           Next
                         </button>
                       </div>
                     </div>
                   )}
                 </>
               )}
            </div>
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
  )
}

export default function Marketplace() {
  return (
    <>
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
      <WhatsAppFloatButton />
    </>
  )
}
