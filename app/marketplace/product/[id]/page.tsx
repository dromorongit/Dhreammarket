'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonReviews } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { useCart, dispatchCartUpdate } from '@/lib/CartContext'
import { MdVerified } from 'react-icons/md'

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

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  averageRating?: number
  reviewCount?: number
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
  
  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([])
  const [averageRating, setAverageRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [starDistribution, setStarDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 })
  const [reviewsLoading, setReviewsLoading] = useState(true)
  
  // User state
  const [user, setUser] = useState<User | null>(null)
  const [canReview, setCanReview] = useState(false)
  
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

  const addToCart = async () => {
    if (!product || addingToCart) return

    setAddingToCart(true)
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1,
        }),
      })

      if (response.ok) {
        const data: CartResponse = await response.json()
        // Dispatch cart update event to sync navbar
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
            description="The product you're looking for doesn't exist or has been removed."
            actionLabel="Back to Marketplace"
            onAction={() => router.push('/marketplace')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
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
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-3">
                <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy leading-tight">
                  {product.name}
                </h1>
                {product.store?.isVerified && (
                  <MdVerified className="w-6 h-6 text-sky-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-slate-600 mb-4 flex items-center gap-2">
                <span className="text-slate-400">by</span>
                <span className="font-medium text-deep-navy flex items-center gap-1">
                  {product.store?.name || 'Unknown Store'}
                  {product.store?.isVerified && (
                    <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0 inline-block" />
                  )}
                </span>
              </p>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  {renderStars(Math.round(averageRating))}
                  <span className="text-slate-600">
                    {averageRating > 0 ? `${averageRating.toFixed(1)} (${totalReviews} review${totalReviews !== 1 ? 's' : ''})` : 'No reviews yet'}
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-4xl sm:text-5xl font-bold text-royal-blue">
                  {formatPrice(product.price)}
                </span>
                <Badge variant={product.stock > 0 ? 'success' : 'danger'}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                </Badge>
              </div>
              {product.category && (
                <div className="mb-6">
                  <Badge variant="default" size="md">
                    {product.category.name}
                  </Badge>
                </div>
              )}
            </div>

            {product.description && (
              <Card variant="outline">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-deep-navy mb-3">Description</h3>
                  <p className="text-slate-600 leading-relaxed">{product.description}</p>
                </CardContent>
              </Card>
            )}

            <Card variant="elevated">
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">Product Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Store</span>
                    <span className="font-medium text-deep-navy flex items-center gap-1">
                      {product.store?.name || 'Unknown Store'}
                      {product.store?.isVerified && (
                        <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0 inline-block" />
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Category</span>
                    <span className="font-medium text-deep-navy">{product.category?.name || 'Unknown Category'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">Stock Status</span>
                    <span className={`font-medium ${product.stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {product.stock > 0 ? `${product.stock} units available` : 'Out of stock'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button
                size="lg"
                className="w-full shadow-lg shadow-royal-blue/20"
                disabled={product.stock === 0 || addingToCart}
                onClick={addToCart}
              >
                {addingToCart
                  ? 'Adding to Cart...'
                  : product.stock > 0
                  ? 'Add to Cart'
                  : 'Out of Stock'}
              </Button>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-deep-navy">Customer Reviews</h2>
              {totalReviews > 0 && (
                <p className="text-slate-600 mt-1">
                  {averageRating.toFixed(1)} out of 5 ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
                </p>
              )}
            </div>
            {user && user.role === 'CUSTOMER' && !showReviewForm && canReview && (
              <Button variant="outline" onClick={() => setShowReviewForm(true)}>
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
                      <p className="text-slate-700 leading-relaxed">{review.comment}</p>
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