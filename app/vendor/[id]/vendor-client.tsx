'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard, SkeletonReviews } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { formatGhanaPhoneNumber, getWhatsAppLink, getTelLink, getWhatsAppLinks } from '@/lib/phone'
import { truncateVendorName } from '@/lib/utils'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { MdVerified } from 'react-icons/md'
import { ProductBadges, calculateProductBadges } from '@/components/ProductBadges'
import { VendorFollowButton } from '@/components/VendorFollowButton'
import { TrustBadge } from '@/components/TrustBadges'
import { getBlurDataURL, HERO_IMAGE_SIZES, CARD_IMAGE_SIZES, CARD_IMAGE_SIZES_3COL, VENDOR_LOGO_SIZES } from '@/lib/image-utils'

interface VendorProduct {
  id: string
  slug: string | null
  name: string
  description: string | null
  price: number
  flashSalePrice?: number | null
  salesPrice?: number | null
  dealsPrice?: number | null
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
  availabilityType?: string
  expectedArrivalDate?: string | null
  estimatedFulfillmentDays?: number | null
  preOrderNotes?: string | null
  expectedRestockDate?: string | null
  backOrderNotes?: string | null
}

interface VendorReview {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  reviewer: string
  isVerifiedPurchase: boolean
}

interface VendorData {
  id: string
  name: string
  description: string | null
  mainPhoneNumber: string | null
  alternativePhoneNumber: string | null
  whatsappNumber: string | null
  location: string
  isVerified: boolean
  isFeatured: boolean
  badgeTier: string | null
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
  services: Array<{
    id: string
    slug: string
    title: string
    shortDescription: string | null
    description: string | null
    startingPrice: number
    pricingType: string
    thumbnail: string | null
    category: { id: string; name: string; slug: string } | null
  }>
  productCount: number
}

interface User {
  id: string
  role: string
  email: string
}

const SITE_URL = 'https://www.dhreamarket.com'
const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/images/dhreamarket.png`

export default function VendorProfilePage() {
  const params = useParams()
  const vendorId = params!.id as string

  const [vendor, setVendor] = useState<VendorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [vendorReviews, setVendorReviews] = useState<VendorReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [vendorRating, setVendorRating] = useState(0)
  const [vendorReviewCount, setVendorReviewCount] = useState(0)
  const [canReviewVendor, setCanReviewVendor] = useState(false)
  const [eligibilityReason, setEligibilityReason] = useState<string | null>(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [userReview, setUserReview] = useState<VendorReview | null>(null)
  const [editingReview, setEditingReview] = useState<VendorReview | null>(null)
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'about' | 'reviews'>('products')

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

  useEffect(() => {
    if (vendorId && vendor) {
      fetch('/api/recently-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'VENDOR', entityId: vendorId }),
      }).catch(() => {})
    }
  }, [vendorId, vendor])

  useEffect(() => {
    if (vendorId) {
      fetchUser()
      fetchVendorReviews()
    }
  }, [vendorId])

  useEffect(() => {
    if (user && user.role === 'CUSTOMER' && vendorId) {
      checkCanReviewVendor()
    } else {
      setCanReviewVendor(false)
      setEligibilityReason(null)
    }
  }, [user, vendorId])

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user || null)
      }
    } catch (e) {
      console.error('Failed to fetch user:', e)
    }
  }

  const fetchVendorReviews = async () => {
    if (!vendorId) return
    try {
      setReviewsLoading(true)
      const response = await fetch(`/api/vendors/${vendorId}/reviews`)
      if (response.ok) {
        const data = await response.json()
        setVendorReviews(data.reviews || [])
        setVendorRating(data.averageRating || 0)
        setVendorReviewCount(data.totalReviews || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setReviewsLoading(false)
    }
  }

  const checkCanReviewVendor = async () => {
    if (!vendorId) return
    try {
      const response = await fetch(`/api/vendors/${vendorId}/reviews?checkEligibility=true`)
      if (response.ok) {
        const data = await response.json()
        setCanReviewVendor(data.canReview || false)
        setEligibilityReason(data.reason || null)
        if (data.userReview) {
          setUserReview(data.userReview)
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const renderStars = (rating: number, interactive: boolean = false, onSelect?: (rating: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onSelect && onSelect(star)}
            className={`text-lg ${
              star <= rating ? 'text-premium-gold' : 'text-slate-300'
            } ${interactive ? 'hover:text-premium-gold cursor-pointer' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
    )
  }

  const getCustomerInitials = (name: string) => {
    return name.charAt(0).toUpperCase()
  }

  const submitVendorReview = async () => {
    if (!vendorId || !reviewComment.trim()) return
    try {
      setSubmittingReview(true)
      setReviewError(null)
      const response = await fetch(`/api/vendors/${vendorId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() }),
      })
      if (response.ok) {
        setReviewComment('')
        setReviewRating(5)
        setShowReviewForm(false)
        fetchVendorReviews()
        checkCanReviewVendor()
      } else {
        const errorData = await response.json()
        setReviewError(errorData.error || 'Failed to submit review')
      }
    } catch (err) {
      setReviewError('Failed to submit review')
      console.error(err)
    } finally {
      setSubmittingReview(false)
    }
  }

  const updateVendorReview = async () => {
    if (!vendorId || !editingReview || !reviewComment.trim()) return
    try {
      setSubmittingReview(true)
      setReviewError(null)
      const response = await fetch(`/api/vendors/${vendorId}/reviews/${editingReview.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment.trim() }),
      })
      if (response.ok) {
        setReviewComment('')
        setReviewRating(5)
        setEditingReview(null)
        setShowReviewForm(false)
        fetchVendorReviews()
        checkCanReviewVendor()
      } else {
        const errorData = await response.json()
        setReviewError(errorData.error || 'Failed to update review')
      }
    } catch (err) {
      setReviewError('Failed to update review')
      console.error(err)
    } finally {
      setSubmittingReview(false)
    }
  }

  const deleteVendorReview = async (reviewId: string) => {
    if (!vendorId) return
    if (!confirm('Are you sure you want to delete this review?')) return
    try {
      setDeletingReviewId(reviewId)
      const response = await fetch(`/api/vendors/${vendorId}/reviews/${reviewId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        fetchVendorReviews()
        checkCanReviewVendor()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingReviewId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="w-full h-64 bg-slate-200 rounded-lg mb-8 animate-pulse" />
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
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
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {vendor.banner && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <Image
            src={vendor.banner}
            alt={`${vendor.name} banner`}
            className="w-full h-full object-cover"
            fill
            priority
            sizes={HERO_IMAGE_SIZES}
            placeholder="blur"
            blurDataURL={getBlurDataURL()}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`bg-white rounded-lg shadow-sm p-8 mb-8 ${vendor.banner ? '-mt-20 relative z-10' : ''}`}>
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-4 border-white shadow-lg">
              {vendor.logo ? (
                <Image src={vendor.logo} alt={vendor.name} className="object-cover w-full h-full" fill sizes={VENDOR_LOGO_SIZES} placeholder="blur" blurDataURL={getBlurDataURL()} />
              ) : (
                <span className="text-4xl font-bold text-slate-700">
                  {vendor.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <h1 className="text-3xl font-bold text-deep-navy">{truncateVendorName(vendor.name)}</h1>
                {(() => {
                  const badgeInfo = getVendorBadgeInfo(vendor.badgeTier as any)
                  if (badgeInfo) {
                    const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                    return (
                      <>
                        <Badge variant={badgeInfo.variant} size="md">
                          {badgeInfo.displayLabel}
                        </Badge>
                        <MdVerified className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                      </>
                    )
                  }
                  if (vendor.isVerified) {
                    return (
                      <MdVerified className="w-4 h-4 text-sky-500 flex-shrink-0 inline-block" />
                    )
                  }
                  return null
                })()}
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

              {(vendor.mainPhoneNumber || vendor.alternativePhoneNumber || vendor.whatsappNumber || vendor.location) && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314l1.414 1.414" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Store Information
                  </h3>
                  <div className="space-y-2">
                    {vendor.location && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                        <span className="text-sm text-slate-600">📍 Location:</span>
                        <span className="text-sm font-medium text-slate-900">
                          {vendor.location}
                        </span>
                      </div>
                    )}
                    {vendor.mainPhoneNumber && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                        <span className="text-sm text-slate-600">📞 Main Call:</span>
                        <a
                          href={getTelLink(vendor.mainPhoneNumber) || '#'}
                          className="text-sm font-medium text-royal-blue hover:text-purple-600 transition-colors"
                        >
                          {formatGhanaPhoneNumber(vendor.mainPhoneNumber) || vendor.mainPhoneNumber}
                        </a>
                      </div>
                    )}
                    {vendor.alternativePhoneNumber && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-200 last:border-0">
                        <span className="text-sm text-slate-600">📞 Alternative:</span>
                        <a
                          href={getTelLink(vendor.alternativePhoneNumber) || '#'}
                          className="text-sm font-medium text-royal-blue hover:text-purple-600 transition-colors"
                        >
                          {formatGhanaPhoneNumber(vendor.alternativePhoneNumber) || vendor.alternativePhoneNumber}
                        </a>
                      </div>
                    )}
                    {vendor.whatsappNumber && (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-slate-600">💬 WhatsApp:</span>
                        <a
                          href={getWhatsAppLink(vendor.whatsappNumber) || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors flex items-center gap-1"
                        >
                          {formatGhanaPhoneNumber(vendor.whatsappNumber) || vendor.whatsappNumber}
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.04 2.01A9.99 9.99 0 002.03 11.91c0 1.7.43 3.33 1.18 4.76L2 22l5.34-1.32a9.93 9.93 0 004.6-1.22 9.99 9.99 0 008.9-8.9c0-2.73-1.08-5.24-2.83-7.03A9.96 9.96 0 0012.04 2.01z" />
                          </svg>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {vendor.whatsappNumber && getWhatsAppLinks(vendor.whatsappNumber).map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12.04 2.01A9.99 9.99 0 002.03 11.91c0 1.7.43 3.33 1.18 4.76L2 22l5.34-1.32a9.93 9.93 0 004.6-1.22 9.99 9.99 0 008.9-8.9c0-2.73-1.08-5.24-2.83-7.03A9.96 9.96 0 0012.04 2.01z" />
                    </svg>
                    Chat on WhatsApp{getWhatsAppLinks(vendor.whatsappNumber).length > 1 ? ` ${index + 1}` : ''}
                  </a>
                ))}
                <VendorFollowButton vendorId={vendor.id} />
                <Link href={`/marketplace?vendorCategory=${vendor.category?.id || ''}`}>
                  <Button variant="outline" size="lg">
                    View All Products
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-2 inline-flex gap-1">
          {[
            { key: 'products' as const, label: 'Products' },
            { key: 'services' as const, label: 'Services' },
            { key: 'about' as const, label: 'About' },
            { key: 'reviews' as const, label: `Reviews${vendorReviewCount > 0 ? ` (${vendorReviewCount})` : ''}` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-royal-blue text-white'
                  : 'text-slate-600 hover:text-royal-blue hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {activeTab === 'products' && (
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
                {vendor.products.map((product) => {
                  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
                  const badgeData = calculateProductBadges({
                    price: product.price,
                    flashSalePrice: product.flashSalePrice,
                    salesPrice: product.salesPrice,
                    dealsPrice: product.dealsPrice,
                    stock: product.stock,
                    availabilityType: product.availabilityType,
                    expectedArrivalDate: product.expectedArrivalDate,
                    expectedRestockDate: product.expectedRestockDate,
                  })
                  return (
                    <Card
                      key={product.id}
                      variant="elevated"
                      className="group flex flex-col overflow-hidden h-full p-0"
                    >
                      <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden w-full">
                          {product.images?.length > 0 ? (
                            <Image
                              src={product.images[0].url}
                              alt={product.images[0].alt || product.name}
                              className="object-cover"
                              fill
                              sizes={CARD_IMAGE_SIZES}
                              placeholder="blur"
                              blurDataURL={getBlurDataURL()}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100">
                              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <ProductBadges product={badgeData} />
                        </div>
                      </Link>
                      <div className="p-2 space-y-1 flex-1 flex flex-col">
                        <Link href={`/marketplace/product/${product.slug ?? product.id}`} className="block">
                          <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                            {product.name}
                          </h3>
                        </Link>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-royal-blue">
                            {formatPrice(effectivePrice)}
                          </span>
                          {(badgeData.discountPercentage ?? 0) > 0 && (
                            <span className="text-[10px] text-slate-400 line-through">
                              {formatPrice(product.price)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 min-w-0">
                          <p className="text-[10px] text-slate-500 truncate">
                            {vendor.name}
                          </p>
                          {(() => {
                            const badgeInfo = getVendorBadgeInfo(vendor.badgeTier as any)
                            if (badgeInfo) {
                              const iconColor = badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'
                              return (
                                <MdVerified className={`w-3 h-3 flex-shrink-0 inline-block ${iconColor}`} />
                              )
                            }
                            if (vendor.isVerified) {
                              return (
                                <MdVerified className="w-3 h-3 text-sky-500 flex-shrink-0 inline-block" />
                              )
                            }
                            return null
                          })()}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'about' && (
          <section className="py-12 border-t border-slate-200">
            {vendor.description && (
              <Card variant="elevated" className="p-8 mb-6">
                <h2 className="text-xl font-bold text-deep-navy mb-4">About {vendor.name}</h2>
                <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{vendor.description}</p>
              </Card>
            )}
            {(vendor.mainPhoneNumber || vendor.alternativePhoneNumber || vendor.whatsappNumber || vendor.location) && (
              <Card variant="elevated" className="p-8">
                <h2 className="text-xl font-bold text-deep-navy mb-6 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Store Information
                </h2>
                <div className="space-y-3">
                  {vendor.location && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314l1.414 1.414" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Location
                      </span>
                      <span className="text-sm font-medium text-slate-900">{vendor.location}</span>
                    </div>
                  )}
                  {vendor.mainPhoneNumber && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Main Call
                      </span>
                      <a href={getTelLink(vendor.mainPhoneNumber) || '#'} className="text-sm font-medium text-royal-blue hover:text-purple-600 transition-colors">
                        {formatGhanaPhoneNumber(vendor.mainPhoneNumber) || vendor.mainPhoneNumber}
                      </a>
                    </div>
                  )}
                  {vendor.alternativePhoneNumber && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Alternative
                      </span>
                      <a href={getTelLink(vendor.alternativePhoneNumber) || '#'} className="text-sm font-medium text-royal-blue hover:text-purple-600 transition-colors">
                        {formatGhanaPhoneNumber(vendor.alternativePhoneNumber) || vendor.alternativePhoneNumber}
                      </a>
                    </div>
                  )}
                  {vendor.whatsappNumber && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.04 2.01A9.99 9.99 0 002.03 11.91c0 1.7.43 3.33 1.18 4.76L2 22l5.34-1.32a9.93 9.93 0 004.6-1.22 9.99 9.99 0 008.9-8.9c0-2.73-1.08-5.24-2.83-7.03A9.96 9.96 0 0012.04 2.01z" />
                        </svg>
                        WhatsApp
                      </span>
                      <a href={getWhatsAppLink(vendor.whatsappNumber) || '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors">
                        {formatGhanaPhoneNumber(vendor.whatsappNumber) || vendor.whatsappNumber}
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </section>
        )}

        {activeTab === 'services' && (
          <section className="py-12 border-t border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-deep-navy">
                Services from {vendor.name}
              </h2>
              <span className="text-sm text-slate-500">
                {vendor.services?.length ?? 0} services
              </span>
            </div>

            {(vendor.services?.length ?? 0) === 0 ? (
              <Card variant="elevated" className="p-12">
                <EmptyState
                  icon={
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-3.582 9 8z" />
                    </svg>
                  }
                  title="No services yet"
                  description="This vendor hasn't added any services yet. Check back soon!"
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendor.services.map((service: any) => (
                  <Card key={service.id} variant="elevated" className="group flex flex-col overflow-hidden h-full">
                    <Link href={`/services/${service.slug}`} className="block">
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden w-full">
                        {service.thumbnail ? (
                          <Image
                            src={service.thumbnail}
                            alt={service.title}
                            className="object-cover"
                            fill
                            sizes={CARD_IMAGE_SIZES_3COL}
                            placeholder="blur"
                            blurDataURL={getBlurDataURL()}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100">
                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-3.582 9 8z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="p-3 flex flex-col flex-1">
                      <Link href={`/services/${service.slug}`} className="block">
                        <h3 className="text-sm font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight mb-1">
                          {service.title}
                        </h3>
                      </Link>
                      <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                        {service.shortDescription || service.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-1">
                        <span className="text-sm font-bold text-royal-blue">
                          {formatPrice(Number(service.startingPrice))}
                        </span>
                        <Link href={`/services/${service.slug}`} className="w-full">
                          <Button variant="outline" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'reviews' && (
          <section className="py-12 border-t border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-deep-navy">Store Reviews</h2>
                {vendorReviewCount > 0 && (
                  <p className="text-slate-600 mt-1">
                    {vendorRating.toFixed(1)} out of 5 ({vendorReviewCount} review{vendorReviewCount !== 1 ? 's' : ''})
                  </p>
                )}
              </div>
              {user && user.role === 'CUSTOMER' && canReviewVendor && !showReviewForm && (
                <Button variant="outline" onClick={() => setShowReviewForm(true)}>
                  Write a Review
                </Button>
              )}
            </div>

            {user && user.role === 'CUSTOMER' && !canReviewVendor && !showReviewForm && eligibilityReason && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-700 text-sm">
                  {eligibilityReason === 'already_reviewed'
                    ? 'You have already reviewed this store. Thank you for your feedback!'
                    : 'You can only review this store after your order is PROCESSING, SHIPPED, DELIVERED, or COMPLETED.'}
                </p>
              </div>
            )}

            {!user && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-700 text-sm">
                  Please <Link href="/login" className="text-royal-blue hover:underline">log in</Link> as a customer to review this store.
                </p>
              </div>
            )}

            {showReviewForm && (
              <Card variant="elevated" className="mb-8">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-deep-navy mb-4">
                    {editingReview ? 'Edit Your Review' : 'Rate This Store'}
                  </h3>
                  {reviewError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                      {reviewError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">Rating</label>
                      {renderStars(reviewRating, true, (r) => setReviewRating(r))}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Your Comment <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue transition-all duration-200"
                        placeholder="Share your experience with this store..."
                      />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button onClick={editingReview ? updateVendorReview : submitVendorReview} disabled={submittingReview}>
                        {submittingReview ? (editingReview ? 'Updating...' : 'Submitting...') : (editingReview ? 'Update Review' : 'Submit Review')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowReviewForm(false)
                          setReviewRating(5)
                          setReviewComment('')
                          setEditingReview(null)
                          setReviewError(null)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {reviewsLoading ? (
              <SkeletonReviews count={3} />
            ) : vendorReviews.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
                title="No reviews yet"
                description={canReviewVendor ? 'Be the first to review this store!' : 'No reviews for this store yet.'}
              />
            ) : (
              <div className="space-y-4">
                {vendorReviews.map((review) => (
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
                          {userReview && userReview.id === review.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingReview(review)
                                  setReviewRating(review.rating)
                                  setReviewComment(review.comment || '')
                                  setShowReviewForm(true)
                                }}
                                className="text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteVendorReview(review.id)}
                                disabled={deletingReviewId === review.id}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                {deletingReviewId === review.id ? 'Deleting...' : 'Delete'}
                              </Button>
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
          </section>
        )}
      </div>
    </div>
  )
}