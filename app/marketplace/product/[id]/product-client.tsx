'use client'

import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { dispatchCartUpdate, handleAuthRedirect } from '@/lib/CartContext'
import { MdVerified } from 'react-icons/md'
import { FiShoppingCart, FiChevronRight, FiStar, FiMinus, FiPlus } from 'react-icons/fi'

interface ProductImage {
  id: string
  url: string
  alt: string | null
}

interface ProductVariant {
  id: string
  color: string | null
  size: string | null
  age: string | null
  sku: string | null
  stock: number
  active: boolean
}

interface ProductReview {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  isVerifiedPurchase: boolean
  reviewer: string
}

interface ProductData {
  id: string
  name: string
  description: string | null
  price: number
  reservedQuantity: number
  availabilityType: string | null
  expectedArrivalDate: string | null
  expectedRestockDate: string | null
  preOrderNotes: string | null
  backOrderNotes: string | null
  salesPrice: number | null
  dealsPrice: number | null
  category: {
    id: string
    name: string
  } | null
  store: {
    id: string
    slug: string | null
    name: string
    isVerified: boolean
    badgeTier: string | null
    logo: string | null
  } | null
  brandRelation: {
    id: string
    name: string
    slug: string
    logo: string | null
  } | null
  brand: string | null
  images: ProductImage[]
  variants: ProductVariant[]
  averageRating: number
  reviewCount: number
  stock: number
}

interface ReviewsResponse {
  reviews: ProductReview[]
  averageRating: number
  totalReviews: number
}

function getAvailabilityStatus(availabilityType: string | null, stock: number): string {
  if (availabilityType === 'PREORDER' || availabilityType === 'BACKORDER') {
    return 'https://schema.org/PreOrder'
  }
  return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

function getStockBadge(availabilityType: string | null, stock: number): { label: string; variant: 'success' | 'danger' | 'info' | 'warning' } {
  if (availabilityType === 'PREORDER') {
    return { label: 'Pre-Order', variant: 'info' }
  }
  if (availabilityType === 'BACKORDER') {
    return { label: 'Backorder', variant: 'warning' }
  }
  return stock > 0 ? { label: 'In Stock', variant: 'success' } : { label: 'Out of Stock', variant: 'danger' }
}

function renderStars(rating: number, size: 'sm' | 'md' = 'md'): React.ReactNode {
  return Array.from({ length: 5 }).map((_, i) => (
    <FiStar
      key={i}
      className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} ${i < Math.floor(rating) ? 'text-premium-gold fill-current' : 'text-slate-300'}`}
    />
  ))
}

export default function ProductClient() {
  const params = useParams()
  const productId = params.id as string

  const [product, setProduct] = useState<ProductData | null>(null)
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description')
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [showFloatingCTA, setShowFloatingCTA] = useState(false)

  const addToCartButtonRef = useRef<HTMLButtonElement>(null)

  const fetchProduct = useCallback(async () => {
    if (!productId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        setProduct(data.product)
        if (data.product?.images?.length > 0) {
          setSelectedImage(data.product.images[0].url)
        } else {
          setSelectedImage(null)
        }
        if (data.product?.variants?.length > 0) {
          const activeVariant = data.product.variants.find((v: ProductVariant) => v.active)
          setSelectedVariant(activeVariant ?? null)
        } else {
          setSelectedVariant(null)
        }
        if (data.product?.reviews) {
          setReviews(data.product.reviews)
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error ?? 'Failed to load product')
      }
    } catch {
      setError('Failed to load product')
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    fetchProduct()
  }, [fetchProduct])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingCTA(!entry.isIntersecting)
      },
      { threshold: 0 }
    )

    if (addToCartButtonRef.current) {
      observer.observe(addToCartButtonRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const fetchReviews = useCallback(async () => {
    if (!productId) return

    try {
      const response = await fetch(`/api/products/${productId}/reviews`)
      if (response.ok) {
        const data: ReviewsResponse = await response.json()
        setReviews(data.reviews)
      }
    } catch {
      console.error('Failed to fetch reviews')
    }
  }, [productId])

  const addToCart = async () => {
    if (!product) return

    setAddingToCart(true)
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          productVariantId: selectedVariant?.id,
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
    } catch {
      alert('Error adding to cart')
    } finally {
      setAddingToCart(false)
    }
  }

  const handleQuantityChange = (newQuantity: number) => {
    const maxStock = selectedVariant ? selectedVariant.stock : product?.stock ?? 0
    const availableStock = product ? product.stock - product.reservedQuantity : 0
    const actualMax = selectedVariant ? selectedVariant.stock : availableStock
    const minQty = 1
    const maxQty = Math.max(minQty, actualMax)
    setQuantity(Math.min(Math.max(minQty, newQuantity), maxQty))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] py-6 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="w-full md:w-[55%]">
              <Skeleton className="aspect-square rounded-xl md:rounded-2xl" />
              <div className="flex gap-2 mt-4 overflow-x-auto">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="w-16 h-16 md:w-20 md:h-20 rounded-lg flex-shrink-0" />
                ))}
              </div>
            </div>
            <div className="w-full md:w-[45%]">
              <div className="space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 md:h-10 w-3/4" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 md:h-12 w-32" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.553 0 2.51-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.466 0L3.34 16c-.771 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#0F1F3D] mb-2">Product Not Found</h2>
            <p className="text-slate-600 mb-6">{error ?? "The product you're looking for doesn't exist."}</p>
            <Link href="/marketplace">
              <Button variant="primary" size="md" fullWidth>Back to Marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const availableStock = product.stock - product.reservedQuantity
  const variantStock = selectedVariant?.stock ?? availableStock
  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.price
  const hasDeal = !!product.dealsPrice && product.dealsPrice < product.price
  const hasSale = !!product.salesPrice && product.salesPrice < product.price && !hasDeal
  const stockBadge = getStockBadge(product.availabilityType, availableStock)

  const descriptionPreview = product.description && product.description.length > 150
    ? product.description.substring(0, 150).trim() + '...'
    : product.description ?? ''

  const currentImageIndex = product.images?.findIndex(img => img.url === selectedImage) ?? 0
  const totalImages = product.images?.length ?? 0

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <nav className="flex items-center gap-1 text-xs md:text-sm mb-4 md:mb-6 overflow-x-auto">
          <Link href="/" className="text-slate-600 hover:text-[#1E40AF] whitespace-nowrap">Home</Link>
          <FiChevronRight className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />
          <Link href="/marketplace" className="text-slate-600 hover:text-[#1E40AF] whitespace-nowrap">Marketplace</Link>
          <FiChevronRight className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />
          {product.category && (
            <>
              <Link href={`/marketplace?category=${product.category.id}`} className="text-slate-600 hover:text-[#1E40AF] whitespace-nowrap">
                {product.category.name}
              </Link>
              <FiChevronRight className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" />
            </>
          )}
          <span className="text-[#0F1F3D] font-medium truncate max-w-[150px] md:max-w-xs">
            {product.name}
          </span>
        </nav>

        <div className="flex flex-col md:flex-row md:gap-8">
          <div className="w-full md:w-[55%]">
            <div className="relative bg-white rounded-xl md:rounded-2xl shadow-lg overflow-hidden mb-4">
              {selectedImage ? (
                <>
                  <div className="relative aspect-square">
                    <Image
                      src={selectedImage}
                      alt={product.name}
                      className="object-contain"
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 55vw"
                    />
                  </div>
                  {totalImages > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      {currentImageIndex + 1} / {totalImages}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-square bg-slate-100 flex items-center justify-center">
                  <svg className="w-16 h-16 md:w-20 md:h-20 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 md:flex-wrap md:pb-0">
                {product.images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.url)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-lg md:rounded-xl overflow-hidden border-2 flex-shrink-0 ${
                      selectedImage === img.url ? 'border-[#1E40AF]' : 'border-slate-200'
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt ?? product.name}
                      className="object-cover"
                      width={80}
                      height={80}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-full md:w-[45%] mt-6 md:mt-0">
            <div className="md:sticky md:top-24">
              {product.category && (
                <Badge variant="info" size="sm" className="mb-3">
                  {product.category.name}
                </Badge>
              )}

              <h1 className="text-2xl md:text-3xl font-bold text-[#0F1F3D] mb-3">
                {product.name}
              </h1>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  {renderStars(product.averageRating, 'sm')}
                </div>
                <span className="text-sm text-slate-600">
                  ({product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'})
                </span>
                <button
                  onClick={() => {
                    setActiveTab('reviews')
                    const reviewsSection = document.getElementById('reviews-tab')
                    reviewsSection?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="text-xs text-[#1E40AF] hover:underline ml-1"
                >
                  See all reviews
                </button>
              </div>

              <div className="mb-4">
                {hasDeal ? (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl md:text-3xl font-bold text-[#1E40AF]">
                      {formatPrice(effectivePrice)}
                    </span>
                    <span className="text-base md:text-lg text-slate-500 line-through">
                      {formatPrice(product.price)}
                    </span>
                    <Badge variant="premium" size="sm">DEAL</Badge>
                  </div>
                ) : hasSale ? (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl md:text-3xl font-bold text-[#1E40AF]">
                      {formatPrice(effectivePrice)}
                    </span>
                    <span className="text-base md:text-lg text-slate-500 line-through">
                      {formatPrice(product.price)}
                    </span>
                    <Badge variant="warning" size="sm">SALE</Badge>
                  </div>
                ) : (
                  <span className="text-2xl md:text-3xl font-bold text-[#1E40AF]">
                    {formatPrice(effectivePrice)}
                  </span>
                )}
              </div>

<Badge variant={stockBadge.variant} size="sm" className="mb-4">
                 {stockBadge.label}
               </Badge>

               {stockBadge.variant === 'success' && availableStock > 0 && (
                 <p className="text-sm text-gray-500 mt-1">{availableStock} items available</p>
               )}

               <div className="mb-6">
                <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                  {showFullDescription ? product.description : descriptionPreview}
                </p>
                {product.description && product.description.length > 150 && (
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="text-xs md:text-sm text-[#1E40AF] font-medium mt-2 hover:underline"
                  >
                    {showFullDescription ? 'Show Less' : 'Show More'}
                  </button>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-[#0F1F3D] mb-2">Quantity</label>
                <div className="flex items-center rounded-xl shadow-sm overflow-hidden w-fit">
                  <button
                    onClick={() => handleQuantityChange(quantity - 1)}
                    disabled={quantity <= 1}
                    className="w-11 h-11 rounded-l-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-xl font-light text-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiMinus className="w-4 h-4" />
                  </button>
                  <div className="w-14 h-11 border-t border-b border-gray-200 bg-white flex items-center justify-center text-base font-semibold text-navy">
                    {quantity}
                  </div>
                  <button
                    onClick={() => handleQuantityChange(quantity + 1)}
                    disabled={quantity >= variantStock}
                    className="w-11 h-11 rounded-r-xl border border-gray-200 bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-xl font-light text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <Button
                  ref={addToCartButtonRef}
                  onClick={addToCart}
                  disabled={addingToCart || availableStock === 0}
                  fullWidth
                  className="h-14 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-semibold text-base rounded-xl flex items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg"
                >
                  <FiShoppingCart className="w-5 h-5" />
                  <span>
                    {addingToCart
                      ? 'Adding...'
                      : availableStock === 0 && product.availabilityType === 'IN_STOCK'
                        ? 'Out of Stock'
                        : product.availabilityType === 'PREORDER'
                          ? 'Pre-order Now'
                          : product.availabilityType === 'BACKORDER'
                            ? 'Backorder'
                            : 'Add to Cart'}
                  </span>
                </Button>
                <Button variant="outline" size="lg" fullWidth className="h-12 md:h-14 text-base md:text-lg font-semibold">
                  Buy Now
                </Button>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center gap-3">
                  {product.store?.logo ? (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                      <Image
                        src={product.store.logo}
                        alt={product.store.name}
                        className="object-cover"
                        width={48}
                        height={48}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 md:w-6 md:h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 7h1m4-7h1m-1 7h1m4-7h1m-1 7h1" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-[#0F1F3D] text-sm md:text-base truncate">
                        {truncateVendorName(product.store?.name ?? 'Unknown Store')}
                      </span>
                      {product.store?.isVerified && (
                        <MdVerified className="w-4 h-4 text-[#1E40AF] flex-shrink-0" />
                      )}
                    </div>
                    <Link
                      href={`/vendor/${product.store?.slug ?? product.store?.id}`}
                      className="text-xs md:text-sm text-[#1E40AF] hover:underline"
                    >
                      View Store
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 md:mt-12">
          <div className="flex gap-4 md:gap-8 border-b border-slate-200 mb-4 md:mb-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('description')}
              className={`pb-3 px-1 text-sm md:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'description'
                  ? 'text-[#1E40AF] border-b-2 border-[#1E40AF]'
                  : 'text-slate-600 hover:text-[#0F1F3D]'
              }`}
            >
              Description
            </button>
            <button
              id="reviews-tab"
              onClick={() => setActiveTab('reviews')}
              className={`pb-3 px-1 text-sm md:text-base font-medium transition-colors whitespace-nowrap ${
                activeTab === 'reviews'
                  ? 'text-[#1E40AF] border-b-2 border-[#1E40AF]'
                  : 'text-slate-600 hover:text-[#0F1F3D]'
              }`}
            >
              Reviews ({product.reviewCount})
            </button>
          </div>

          <div className="min-h-[200px]">
            {activeTab === 'description' ? (
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                  {product.description ?? 'No description available for this product.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <EmptyState
                    icon={
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.417-4.03 8-9 8a9.863 9.863 0 01-4.255-.94L3 20l1.395-2.42C3.512 15.042 3 13.574 3 12c0-1.593.559-3.036 1.544-4.292A8.966 8.966 0 0112 4.97c4.97 0 9 3.582 9 8z" />
                      </svg>
                    }
                    title="No reviews yet"
                    description="Be the first to review this product."
                  />
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          {renderStars(review.rating, 'sm')}
                        </div>
                        <span className="text-sm font-medium text-[#0F1F3D]">{review.reviewer}</span>
                        {review.isVerifiedPurchase && (
                          <Badge variant="success" size="sm">Verified</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">
                        {new Date(review.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-slate-600 text-sm">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showFloatingCTA && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50 md:hidden shadow-2xl">
          <div className="flex items-center justify-between gap-4">
<div>
                <span className="text-xs text-slate-600">Price:</span>
                <p className="text-base font-bold text-[#0F1F3D]">
                  {formatPrice(effectivePrice)}
                </p>
              </div>
            <Button
              onClick={addToCart}
              disabled={addingToCart || availableStock === 0}
              variant="primary"
              size="md"
              className="flex-1 max-w-xs h-11"
            >
              <FiShoppingCart className="w-4 h-4 mr-1" />
              Add to Cart
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}