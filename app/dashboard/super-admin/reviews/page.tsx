'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface ProductReview {
  id: string
  rating: number
  comment: string | null
  isApproved: boolean
  isHidden: boolean
  createdAt: string
  user: {
    id: string
    email: string
    profile: {
      firstName: string | null
      lastName: string | null
    } | null
  }
  product: {
    id: string
    name: string
  }
}

interface VendorReview {
  id: string
  rating: number
  comment: string | null
  isApproved: boolean
  isHidden: boolean
  createdAt: string
  user: {
    id: string
    email: string
    profile: {
      firstName: string | null
      lastName: string | null
    } | null
  }
  store: {
    id: string
    name: string
  }
}

type ReviewTab = 'product' | 'vendor'

export default function SuperAdminReviewsPage() {
  const [activeTab, setActiveTab] = useState<ReviewTab>('product')
  const [productReviews, setProductReviews] = useState<ProductReview[]>([])
  const [vendorReviews, setVendorReviews] = useState<VendorReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchReviews()
  }, [activeTab, page, search])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
      })
      
      const endpoint = activeTab === 'product' 
        ? `/api/super-admin/reviews/product?${params}`
        : `/api/super-admin/reviews/vendor?${params}`
      
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load reviews')
        return
      }
      
      const data = await response.json()
      
      if (activeTab === 'product') {
        setProductReviews(data.reviews || [])
      } else {
        setVendorReviews(data.reviews || [])
      }
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      console.error('Error fetching reviews:', err)
      setError('An error occurred while loading reviews')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (reviewId: string, action: 'approve' | 'hide' | 'delete', type: 'product' | 'vendor') => {
    setActionLoading(reviewId)
    try {
      const endpoint = type === 'product' 
        ? `/api/super-admin/reviews/product/${reviewId}`
        : `/api/super-admin/reviews/vendor/${reviewId}`
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || `Failed to ${action} review`)
        return
      }
      
      // Remove the review from the list if deleted, or update its status
      if (action === 'delete') {
        if (type === 'product') {
          setProductReviews(prev => prev.filter(r => r.id !== reviewId))
        } else {
          setVendorReviews(prev => prev.filter(r => r.id !== reviewId))
        }
      } else {
        fetchReviews()
      }
    } catch (err) {
      console.error(`Error ${action} review:`, err)
      alert(`Failed to ${action} review`)
    } finally {
      setActionLoading(null)
    }
  }

  const getReviewerName = (review: ProductReview | VendorReview) => {
    if (review.user.profile?.firstName || review.user.profile?.lastName) {
      return [review.user.profile?.firstName, review.user.profile?.lastName].filter(Boolean).join(' ')
    }
    return review.user.email.split('@')[0]
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${
              star <= rating ? 'text-yellow-400' : 'text-slate-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
    )
  }

  if (loading && (activeTab === 'product' ? productReviews.length === 0 : vendorReviews.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Reviews</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href="/dashboard/super-admin">
                <Button>Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const reviews = activeTab === 'product' ? productReviews : vendorReviews

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/dashboard/super-admin" 
            className="text-royal-blue hover:text-royal-blue/80 text-sm font-medium inline-flex items-center mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-deep-navy">Review Moderation</h1>
          <p className="text-slate-600 mt-1">Manage and moderate customer reviews</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setActiveTab('product')
              setPage(1)
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'product'
                ? 'bg-royal-blue text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Product Reviews
          </button>
          <button
            onClick={() => {
              setActiveTab('vendor')
              setPage(1)
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'vendor'
                ? 'bg-royal-blue text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Vendor Reviews
          </button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchReviews(); }}>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search by review ID, comment, or reviewer email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
              </svg>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No reviews found</h3>
              <p className="text-slate-600">
                {search 
                  ? 'Try adjusting your search terms'
                  : 'No reviews to moderate at this time'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {reviews.map((review) => (
                <Card key={review.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {renderStars(review.rating)}
                          <span className="text-sm text-slate-500">by {getReviewerName(review)}</span>
                          {!review.isApproved && (
                            <Badge variant="warning">Pending Approval</Badge>
                          )}
                          {review.isHidden && (
                             <Badge variant="danger">Hidden</Badge>
                           )}
                        </div>
                        {activeTab === 'product' && (
                          <p className="text-sm text-slate-600 mb-2">
                            Product: {(review as ProductReview).product.name}
                          </p>
                        )}
                        {activeTab === 'vendor' && (
                          <p className="text-sm text-slate-600 mb-2">
                            Store: {(review as VendorReview).store.name}
                          </p>
                        )}
                        {review.comment && (
                          <p className="text-slate-800 mt-2">{review.comment}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-3">
                          {new Date(review.createdAt).toLocaleDateString('en-GH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {!review.isApproved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(review.id, 'approve', activeTab)}
                            disabled={actionLoading === review.id}
                          >
                            {actionLoading === review.id ? 'Approving...' : 'Approve'}
                          </Button>
                        )}
                        {review.isApproved && !review.isHidden && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(review.id, 'hide', activeTab)}
                            disabled={actionLoading === review.id}
                          >
                            {actionLoading === review.id ? 'Hiding...' : 'Hide'}
                          </Button>
                        )}
                        {review.isHidden && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(review.id, 'approve', activeTab)}
                            disabled={actionLoading === review.id}
                          >
                            Unhide
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(review.id, 'delete', activeTab)}
                          disabled={actionLoading === review.id}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          {actionLoading === review.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-slate-600">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} reviews
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}