'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonReviews } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { useCart, dispatchCartUpdate } from '@/lib/CartContext'
import { MdVerified } from 'react-icons/md'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'

interface CartResponse {
  cart: {
    id: string | null
    items: Array<any>
    total: number
  }
}

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  reviewer: string
  isVerifiedPurchase: boolean
}

interface ProductVariant {
  id: string
  color?: string
  size?: string
  age?: string
  sku?: string
  stock: number
  active: boolean
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  salesPrice?: number | null
  dealsPrice?: number | null
  stock: number
  averageRating?: number
  reviewCount?: number
  brand?: {
    id: string
    name: string
    slug: string
    logo?: string | null
  }
  category?: {
    id: string
    name: string
  }
  store?: {
    id: string
    name: string
    isVerified?: boolean
  }
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
  availabilityType?: string
  expectedArrivalDate?: string | null
  estimatedFulfillmentDays?: number | null
  preOrderNotes?: string | null
  expectedRestockDate?: string | null
  backOrderNotes?: string | null
}

interface User {
  id: string
  role: string
  email: string
}

export default function ProductDetail() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [addingToCart, setAddingToCart] = useState(false)
  const [quantity, setQuantity] = useState(1)
  
  // Variant selection state
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [selectedAge, setSelectedAge] = useState<string>('')
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [starDistribution, setStarDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 })
  const [reviewsLoading, setReviewsLoading] = useState(true)
  
// User state
   const [user, setUser] = useState<User | null>(null)
   const [canReview, setCanReview] = useState(false)

   // Waiting customer count for preorder/backorder
   const [waitingCustomerCount, setWaitingCustomerCount] = useState(0)
  
  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    fetchProduct()
    fetchUser()
  }, [productId])

  useEffect(() => {
    if (productId && user) {
      fetchReviews()
    }
  }, [productId, user])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
    }
  }

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const data = await response.json()
        setProduct(data.product)
        // Set default variant if only one exists
        const p = data.product as Product
        if (p.variants && p.variants.length > 0 && p.variants[0].active) {
          setSelectedVariant(p.variants[0])
          if (p.variants[0].color) setSelectedColor(p.variants[0].color)
          if (p.variants[0].size) setSelectedSize(p.variants[0].size)
          if (p.variants[0].age) setSelectedAge(p.variants[0].age)
        }
        
// Fetch waiting customer count for preorder/backorder products
         if (p.availabilityType === 'PREORDER' || p.availabilityType === 'BACKORDER') {
           try {
             const countRes = await fetch(`/api/products/${productId}`, {
               method: 'PATCH',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ type: 'waiting-customers' }),
             })
             if (countRes.ok) {
               const countData = await countRes.json()
               setWaitingCustomerCount(countData.count)
             }
           } catch (e) {
             console.error('Error fetching waiting count:', e)
           }
         }
      } else {
        alert('Product not found')
        router.push('/marketplace')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      alert('Error loading product')
      router.push('/marketplace')
    } finally {
      setLoading(false)
    }
  }

  const fetchReviews = async () => {
    setReviewsLoading(true)
    try {
      const response = await fetch(`/api/products/${productId}/reviews`)
      if (response.ok) {
        const data = await response.json()
        setReviews(data.reviews)
        setAverageRating(data.averageRating)
        setTotalReviews(data.totalReviews)
        setStarDistribution(data.starDistribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 })
        
        // Check if user can review
        if (user && user.role === 'CUSTOMER') {
          checkCanReview()
        }
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setReviewsLoading(false)
    }
  }

  const checkCanReview = async () => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews?checkEligibility=true`, {
        headers: {
          'Authorization': `Bearer ${document.cookie?.match(/token=([^;]+)/)?.[1]}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setCanReview(data.canReview)
      }
    } catch (error) {
      console.error('Error checking review eligibility:', error)
    }
  }

  // Get available options for variant selection
  const availableColors = useMemo(() => {
    return product?.variants?.filter(v => v.active).reduce((acc: string[], v) => {
      if (v.color && !acc.includes(v.color)) acc.push(v.color)
      return acc
    }, []) || []
  }, [product?.variants])

  const availableSizes = useMemo(() => {
    return product?.variants?.filter(v => v.active).reduce((acc: string[], v) => {
      if (v.size && !acc.includes(v.size)) acc.push(v.size)
      return acc
    }, []) || []
  }, [product?.variants])

  const availableAges = useMemo(() => {
    return product?.variants?.filter(v => v.active).reduce((acc: string[], v) => {
      if (v.age && !acc.includes(v.age)) acc.push(v.age)
      return acc
    }, []) || []
  }, [product?.variants])

  // Find selected variant when options change
  useEffect(() => {
     if (!product?.variants?.length) {
       setSelectedVariant(null)
       return
     }

     const found = product.variants.find(v => 
       v.active &&
       (selectedColor ? v.color === selectedColor : true) &&
       (selectedSize ? v.size === selectedSize : true) &&
       (selectedAge ? v.age === selectedAge : true)
     )
     setSelectedVariant(found || null)
     // Reset quantity when variant changes
     setQuantity(1)
   }, [selectedColor, selectedSize, selectedAge, product?.variants])

  // Calculate display price with discount logic
  const displayPrice = useMemo(() => {
    if (!product) return 0
    if (product.dealsPrice) return product.dealsPrice
    if (product.salesPrice) return product.salesPrice
    return product.price
  }, [product])

  const hasDiscount = useMemo(() => {
    return !!(product?.dealsPrice || product?.salesPrice)
  }, [product?.dealsPrice, product?.salesPrice])

  const discountPercentage = useMemo(() => {
    if (!product || !hasDiscount) return 0
    const discountedPrice = displayPrice
    if (product.price <= discountedPrice) return 0
    return Math.round(((product.price - discountedPrice) / product.price) * 100)
  }, [product, displayPrice, hasDiscount])

  // Get available stock (variant stock or product stock)
  const availableStock = useMemo(() => {
    if (selectedVariant) return selectedVariant.stock
    return product?.stock || 0
  }, [selectedVariant, product?.stock])

  const addToCart = async () => {
     if (!product || addingToCart) return

     const hasVariants = product.variants && product.variants.length > 0
     if (hasVariants && !selectedVariant) {
       alert('Please select a product variant')
       return
     }

     // Validate quantity against stock
     if (quantity > availableStock) {
       alert(`Cannot add more than ${availableStock} to cart`)
       return
     }

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
           productVariantId: selectedVariant?.id || null,
           color: selectedVariant?.color || null,
           size: selectedVariant?.size || null,
           age: selectedVariant?.age || null,
         }),
       })

      if (response.ok) {
        const data: CartResponse = await response.json()
        dispatchCartUpdate()
        alert('Product added to cart!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add to cart')
      }
    } catch (error) {
      console.error('Error adding to cart:', error)
      alert('Error adding to cart')
    } finally {
      setAddingToCart(false)
    }
  }

  const submitReview = async () => {
    if (!user || submittingReview) return

    setSubmittingReview(true)
    try {
      const url = editingReview 
        ? `/api/products/${productId}/reviews/${editingReview.id}`
        : `/api/products/${productId}/reviews`
      
      const response = await fetch(url, {
        method: editingReview ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment,
        }),
      })

      if (response.ok) {
        alert(editingReview ? 'Review updated successfully!' : 'Review submitted successfully!')
        setShowReviewForm(false)
        setEditingReview(null)
        setReviewRating(5)
        setReviewComment('')
        fetchReviews()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to submit review')
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('Error submitting review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const deleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return

    try {
      const response = await fetch(`/api/products/${productId}/reviews/${reviewId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        alert('Review deleted successfully!')
        fetchReviews()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete review')
      }
    } catch (error) {
      console.error('Error deleting review:', error)
      alert('Error deleting review')
    }
  }

  const getCustomerInitials = (email: string): string => {
    const name = email.split('@')[0]
    return name.substring(0, 2).toUpperCase()
  }

  const renderStars = (rating: number, interactive = false, onChange?: (r: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(star)}
            className={`text-2xl ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
              ${star <= rating ? 'text-yellow-400' : 'text-slate-300'}`}
          >
            ★
          </button>
        ))}
      </div>
    )
  }

  const renderStarDistribution = () => {
    const total = Object.values(starDistribution).reduce((a, b) => a + b, 0)
    if (total === 0) return null

    return (
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = starDistribution[star as keyof typeof starDistribution]
          const percentage = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-3">{star}★</span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-400 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-right text-slate-500">{count}</span>
            </div>
          )
        })}
      </div>
    )
  }

  const hasVariants = product?.variants && product.variants.length > 0

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-8">
            <button className="text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
              ← Back to Marketplace
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-slate-200 rounded-2xl"></div>
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-32" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Product Not Found"
            description="The product you&apos;re looking for doesn&apos;t exist or has been removed."
            actionLabel="Back to Marketplace"
            onAction={() => router.push('/marketplace')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 lg:pb-0">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <button
          onClick={() => router.push('/marketplace')}
          className="text-slate-600 hover:text-deep-navy inline-flex items-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Marketplace
        </button>
      </div>

      {/* Product Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          {/* Product Images */}
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 shadow-lg">
              {product.images.length > 0 ? (
                <img
                  src={product.images[selectedImageIndex].url}
                  alt={product.images[selectedImageIndex].alt || product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedImageIndex === index ? 'border-royal-blue shadow-lg' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <img
                      src={image.url}
                      alt={image.alt || `Product image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6 min-w-0">
            <div>
              <div className="flex items-start justify-between mb-3 min-w-0">
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy leading-tight break-words min-w-0">
                   {product.name}
                 </h1>
                 {(() => {
                   const badgeInfo = getVendorBadgeInfo((product.store as any)?.badgeTier)
                   if (badgeInfo) {
                     const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                     return (
                       <Badge variant={badgeInfo.variant} size="sm" className="ml-2">
                         {badgeInfo.displayLabel}
                       </Badge>
                     )
                   }
                   if (product.store?.isVerified) {
                     return (
                       <MdVerified className="w-5 h-5 sm:w-6 sm:h-6 text-sky-500 flex-shrink-0 ml-2" />
                     )
                   }
                   return null
                 })()}
               </div>
              <p className="text-slate-600 mb-4 flex items-center gap-2 min-w-0">
                <span className="text-slate-400 flex-shrink-0">by</span>
<span className="font-medium text-deep-navy flex items-center gap-1 min-w-0 overflow-hidden text-ellipsis">
                   {product.store?.name || 'Unknown Store'}
                   {(() => {
                     const badgeInfo = getVendorBadgeInfo((product.store as any)?.badgeTier)
                     if (badgeInfo) {
                       const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                       return (
                         <MdVerified className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 inline-block ${iconColor}`} />
                       )
                     }
                     if (product.store?.isVerified) {
                       return (
                         <MdVerified className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0 inline-block" />
                       )
                     }
                     return null
                   })()}
                 </span>
              </p>
              <div className="flex items-center gap-3 sm:gap-4 mb-6">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  {renderStars(Math.round(averageRating))}
                  <span className="text-slate-600 text-sm sm:text-base">
                    {averageRating > 0 ? `${averageRating.toFixed(1)} (${totalReviews} review${totalReviews !== 1 ? 's' : ''})` : 'No reviews yet'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-6 min-w-0">
                {hasDiscount && (
                  <>
                    <span className="text-base sm:text-lg text-slate-400 line-through">
                      {formatPrice(product.price)}
                    </span>
                    <Badge variant="success" size="sm" className="text-xs">
                      -{discountPercentage}%
                    </Badge>
                  </>
                )}
                <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-royal-blue break-words">
                  {formatPrice(displayPrice)}
                </span>
                {product.availabilityType === 'PREORDER' && (
                  <Badge variant="preorder">
                    Pre-order Available
                  </Badge>
                )}
                {product.availabilityType === 'BACKORDER' && product.stock === 0 && (
                  <Badge variant="backorder">
                    Backorder
                  </Badge>
                )}
                {product.availabilityType === 'IN_STOCK' && (
                  <Badge variant={availableStock > 0 ? 'success' : 'danger'}>
                    {availableStock > 0 ? `${availableStock} in stock` : 'Out of stock'}
                  </Badge>
                )}
              </div>
              {product.category && (
                <div className="mb-6 min-w-0">
                  <Badge variant="default" size="md" className="break-words">
                    {product.category.name}
                  </Badge>
                </div>
              )}

{(product.availabilityType === 'PREORDER' || product.availabilityType === 'BACKORDER') && (
                 <Card variant="elevated" className="mb-6">
                   <CardContent className="pt-6">
                     <h3 className="text-lg font-semibold text-deep-navy mb-3 break-words">
                       {product.availabilityType === 'PREORDER' ? 'Pre-order Information' : 'Backorder Information'}
                     </h3>
                     {product.availabilityType === 'PREORDER' && product.expectedArrivalDate && (
                       <p className="text-sm text-slate-600 mb-2 break-words">
                         Expected arrival: {new Date(product.expectedArrivalDate).toLocaleDateString('en-US', {
                           year: 'numeric',
                           month: 'long',
                           day: 'numeric',
                         })}
                       </p>
                     )}
                     {product.availabilityType === 'PREORDER' && product.estimatedFulfillmentDays && (
                       <p className="text-sm text-slate-600 mb-2 break-words">
                         Estimated fulfillment: {product.estimatedFulfillmentDays} days
                       </p>
                     )}
                     {product.availabilityType === 'BACKORDER' && product.expectedRestockDate && (
                       <p className="text-sm text-slate-600 mb-2 break-words">
                         Expected restock: {new Date(product.expectedRestockDate).toLocaleDateString('en-US', {
                           year: 'numeric',
                           month: 'long',
                           day: 'numeric',
                         })}
                       </p>
                     )}
                     {waitingCustomerCount > 0 && (
                       <p className="text-sm text-royal-blue font-medium mb-2 break-words">
                         {waitingCustomerCount} customer{waitingCustomerCount !== 1 ? 's' : ''} waiting for this product
                       </p>
                     )}
                     {product.availabilityType === 'PREORDER' && product.preOrderNotes && (
                       <p className="text-sm text-slate-600 mt-2 break-words">{product.preOrderNotes}</p>
                     )}
                     {product.availabilityType === 'BACKORDER' && product.backOrderNotes && (
                       <p className="text-sm text-slate-600 mt-2 break-words">{product.backOrderNotes}</p>
                     )}
                   </CardContent>
                 </Card>
               )}
            </div>

            {product.description && (
              <Card variant="outline">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-deep-navy mb-3 break-words">Description</h3>
                  <p className="text-slate-600 leading-relaxed break-words">{product.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Variant Selection */}
            {hasVariants && (
              <Card variant="elevated">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-deep-navy mb-4">Select Variant</h3>
                  
                  {availableColors.length > 0 && (
                    <div className="mb-4 min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-2 break-words">Color</label>
                      <div className="flex flex-wrap gap-2 min-w-0">
                        {availableColors.map((color) => {
                          const isActive = product.variants?.some(v => v.color === color && v.active)
                          const isInStock = selectedColor === color ? availableStock > 0 : false
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setSelectedColor(color)
                                setSelectedSize('')
                                setSelectedAge('')
                              }}
                              disabled={!isActive}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all break-words min-w-0 ${
                                selectedColor === color
                                  ? 'bg-royal-blue text-white'
                                  : isActive
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {color}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {availableSizes.length > 0 && (
                    <div className="mb-4 min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-2 break-words">Size</label>
                      <div className="flex flex-wrap gap-2 min-w-0">
                        {availableSizes.map((size) => {
                          const isAvailable = product.variants?.some(v => 
                            v.size === size && v.active && 
                            (selectedColor ? v.color === selectedColor : true)
                          )
                          return (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setSelectedSize(size)}
                              disabled={!isAvailable}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all break-words min-w-0 ${
                                selectedSize === size
                                  ? 'bg-royal-blue text-white'
                                  : isAvailable
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {size}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {availableAges.length > 0 && (
                    <div className="mb-4 min-w-0">
                      <label className="block text-sm font-medium text-slate-700 mb-2 break-words">Age</label>
                      <div className="flex flex-wrap gap-2 min-w-0">
                        {availableAges.map((age) => {
                          const isAvailable = product.variants?.some(v => 
                            v.age === age && v.active && 
                            (selectedColor ? v.color === selectedColor : true) &&
                            (selectedSize ? v.size === selectedSize : true)
                          )
                          return (
                            <button
                              key={age}
                              type="button"
                              onClick={() => setSelectedAge(age)}
                              disabled={!isAvailable}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all break-words min-w-0 ${
                                selectedAge === age
                                  ? 'bg-royal-blue text-white'
                                  : isAvailable
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {age}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {!selectedVariant && (
                    <p className="text-sm text-rose-600 mt-2">Please select a variant to add to cart</p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card variant="elevated">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4 break-words">Product Details</h3>
                <div className="space-y-3">
                  {product.brand && (
                    <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 gap-1 sm:gap-0">
                      <span className="text-slate-600 flex-shrink-0">Brand</span>
                      <span className="font-medium text-deep-navy break-words min-w-0">{product.brand.name}</span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 gap-1 sm:gap-0">
                    <span className="text-slate-600 flex-shrink-0">Store</span>
                    <span className="font-medium text-deep-navy flex items-center gap-1 min-w-0 flex-1 flex-wrap">
                      {product.store?.name || 'Unknown Store'}
                      {(() => {
                        const badgeInfo = getVendorBadgeInfo((product.store as any)?.badgeTier)
                        if (badgeInfo) {
                          const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                          return (
                            <MdVerified className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 inline-block ${iconColor}`} />
                          )
                        }
                        if (product.store?.isVerified) {
                          return (
                            <MdVerified className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 flex-shrink-0 inline-block" />
                          )
                        }
                        return null
                      })()}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 gap-1 sm:gap-0">
                    <span className="text-slate-600 flex-shrink-0">Category</span>
                    <span className="font-medium text-deep-navy break-words min-w-0">{product.category?.name || 'Unknown Category'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 gap-1 sm:gap-0">
                    <span className="text-slate-600 flex-shrink-0">Stock Status</span>
                    <span className={`font-medium break-words min-w-0 ${availableStock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {availableStock > 0 ? `${availableStock} units available` : 'Out of stock'}
                    </span>
                  </div>
                  {hasVariants && (
                    <div className="flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-100 gap-1 sm:gap-0">
                      <span className="text-slate-600 flex-shrink-0">Variants</span>
                      <span className="font-medium text-deep-navy break-words min-w-0">{product.variants.length} option{product.variants.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {hasVariants && selectedVariant && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Quantity</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-deep-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={availableStock}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        setQuantity(Math.min(Math.max(1, val), availableStock))
                      }}
                      className="w-12 text-center font-semibold text-deep-navy bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                      disabled={quantity >= availableStock}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-deep-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-sm text-slate-600">Max: {availableStock}</span>
                </div>
              </div>
            )}

            {!hasVariants && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Quantity</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-deep-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={availableStock}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1
                        setQuantity(Math.min(Math.max(1, val), availableStock))
                      }}
                      className="w-12 text-center font-semibold text-deep-navy bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
                      disabled={quantity >= availableStock}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-deep-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-sm text-slate-600">Max: {availableStock}</span>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full min-h-[48px] shadow-lg shadow-royal-blue/20"
                disabled={(product.availabilityType === 'IN_STOCK' && availableStock === 0) || addingToCart || (hasVariants && !selectedVariant)}
                onClick={addToCart}
              >
                {addingToCart
                  ? 'Adding to Cart...'
                  : product.availabilityType === 'PREORDER'
                  ? 'Pre-order Now'
                  : product.availabilityType === 'BACKORDER'
                  ? 'Backorder Request'
                  : availableStock > 0
                  ? 'Add to Cart'
                  : 'Out of Stock'}
              </Button>
            </div>

            {/* Mobile Sticky Purchase Bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 p-4 z-40 pb-safe">
              <div className="max-w-4xl mx-auto px-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-500 text-xs">Price</p>
                  <p className="text-xl font-bold text-royal-blue break-words">{formatPrice(displayPrice)}</p>
                  {hasDiscount && (
                    <p className="text-slate-400 text-sm line-through">{formatPrice(product.price)}</p>
                  )}
                </div>
                <Button
                  size="lg"
                  className="min-h-[48px] px-6 whitespace-nowrap"
                  disabled={(product.availabilityType === 'IN_STOCK' && availableStock === 0) || addingToCart || (hasVariants && !selectedVariant)}
                  onClick={addToCart}
                >
                  {addingToCart
                    ? 'Adding...'
                    : product.availabilityType === 'PREORDER'
                    ? 'Pre-order Now'
                    : product.availabilityType === 'BACKORDER'
                    ? 'Backorder Request'
                    : availableStock > 0
                    ? 'Add to Cart'
                    : 'Out of Stock'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16 lg:mt-20 pb-20 lg:pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-deep-navy">Customer Reviews</h2>
              {totalReviews > 0 && (
                <p className="text-slate-600 mt-1 text-sm sm:text-base">
                  {averageRating.toFixed(1)} out of 5 ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
                </p>
              )}
            </div>
            {user && user.role === 'CUSTOMER' && !showReviewForm && canReview && (
              <Button variant="outline" size="sm" className="sm:size-md min-h-[44px]">
                Write a Review
              </Button>
            )}
          </div>

          {/* Star Distribution */}
          {totalReviews > 0 && (
            <Card variant="elevated" className="mb-8">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">Rating Distribution</h3>
                {renderStarDistribution()}
              </CardContent>
            </Card>
          )}

          {/* Review Form */}
          {showReviewForm && (
            <Card variant="elevated" className="mb-8">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">
                  {editingReview ? 'Edit Your Review' : 'Write Your Review'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Rating</label>
                    {renderStars(reviewRating, true, (r) => setReviewRating(r))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Review (optional)</label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue transition-all duration-200"
                      placeholder="Share your experience with this product..."
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={submitReview} disabled={submittingReview}>
                      {submittingReview ? (editingReview ? 'Updating...' : 'Submitting...') : (editingReview ? 'Update Review' : 'Submit Review')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowReviewForm(false)
                        setEditingReview(null)
                        setReviewRating(5)
                        setReviewComment('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews List */}
          {reviewsLoading ? (
            <SkeletonReviews count={3} />
          ) : reviews.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              }
              title="No reviews yet"
              description={canReview ? 'Be the first to review this product!' : 'No reviews for this product yet.'}
            />
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} variant="elevated">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-royal-blue/10 flex items-center justify-center text-royal-blue font-semibold">
                          {getCustomerInitials(review.reviewer)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-deep-navy">{review.reviewer}</p>
                            {review.isVerifiedPurchase && (
                              <Badge variant="success" size="sm" className="text-[10px] px-1.5 py-0">
                                Verified Purchase
                              </Badge>
                            )}
                          </div>
                          {renderStars(review.rating)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">
                          {new Date(review.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {user && user.role === 'CUSTOMER' && canReview && (
                          <>
                            <button
                              onClick={() => {
                                setEditingReview(review)
                                setReviewRating(review.rating)
                                setReviewComment(review.comment || '')
                                setShowReviewForm(true)
                              }}
                              className="text-slate-400 hover:text-royal-blue transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteReview(review.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12m4-12v12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-slate-700 leading-relaxed break-words">{review.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}