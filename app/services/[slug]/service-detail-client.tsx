'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { formatPrice } from '@/lib/currency'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { MdVerified } from 'react-icons/md'
import WishlistButton from '@/components/WishlistButton'
import { PricingType, AvailabilityStatus } from '@prisma/client'
import { Skeleton } from '@/components/Skeleton'

interface RelatedService {
  id: string
  slug: string
  title: string
  startingPrice: number
  pricingType: PricingType
  thumbnail: string | null
  images: Array<{ id: string; imageUrl: string; displayOrder: number }>
  store: { id: string; name: string; slug: string; isVerified: boolean; badgeTier: string | null }
  category: { id: string; name: string; slug: string }
}

interface ServiceDetailProps {
  serviceId: string
}

export default function ServiceDetail({ serviceId }: ServiceDetailProps) {
  const [service, setService] = useState<any>(null)
  const [relatedServices, setRelatedServices] = useState<RelatedService[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const [wishlistServiceIds, setWishlistServiceIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchService()
    fetchRelatedServices()
    checkWishlist()
  }, [serviceId])

  const fetchService = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/services/${serviceId}`)
      if (response.ok) {
        const data = await response.json()
        setService(data.service)
      } else {
        setService(null)
      }
    } catch (error) {
      console.error('Error fetching service:', error)
      setService(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchRelatedServices = async () => {
    try {
      if (!service) return
      const categoryId = service.category?.id
      const vendorId = service.store?.id
      const serviceTags = service.tags || []

      const seen = new Set<string>([service.id])
      const related: RelatedService[] = []

      const addServices = (items: any[]) => {
        for (const item of items) {
          if (!seen.has(item.id)) {
            seen.add(item.id)
            related.push(item)
          }
        }
      }

      if (categoryId) {
        const res = await fetch(`/api/services?categoryId=${categoryId}&limit=8&sortBy=createdAt&sortOrder=desc`)
        if (res.ok) {
          const data = await res.json()
          addServices((data.services || []).filter((s: any) => s.id !== service.id))
        }
      }

      if (related.length < 4 && vendorId) {
        const res = await fetch(`/api/services?vendorId=${vendorId}&limit=8&sortBy=createdAt&sortOrder=desc`)
        if (res.ok) {
          const data = await res.json()
          addServices((data.services || []).filter((s: any) => s.id !== service.id))
        }
      }

      if (related.length < 4 && serviceTags.length > 0) {
        const res = await fetch(`/api/services?limit=20&sortBy=createdAt&sortOrder=desc`)
        if (res.ok) {
          const data = await res.json()
          const tagged = (data.services || []).filter((s: any) => {
            if (s.id === service.id) return false
            const common = s.tags?.filter((t: string) => serviceTags.includes(t)) || []
            return common.length > 0
          })
          addServices(tagged)
        }
      }

      setRelatedServices(related.slice(0, 4))
    } catch (error) {
      console.error('Error fetching related services:', error)
    }
  }

  const checkWishlist = async () => {
    try {
      const response = await fetch(`/api/wishlist/check?serviceIds=${serviceId}`)
      if (response.ok) {
        const data = await response.json()
        setWishlistServiceIds(new Set(data.serviceIds || []))
      }
    } catch (error) {
      console.error('Error checking wishlist:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            <Skeleton className="aspect-video rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-12 w-40" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Service Not Found"
            description="The service you're looking for doesn't exist or has been removed."
            actionLabel="Browse Services"
            onAction={() => window.location.href = '/services'}
          />
        </div>
      </div>
    )
  }

  const allImages = service.thumbnail ? [service.thumbnail, ...(service.gallery || [])] : service.images || []
  const effectivePrice = Number(service.startingPrice)
  const badgeInfo = getVendorBadgeInfo(service.store?.badgeTier)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Gallery */}
      {allImages.length > 0 && (
        <section className="relative bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="relative aspect-video rounded-2xl overflow-hidden">
              <Image
                src={allImages[activeGalleryIndex]?.imageUrl || allImages[activeGalleryIndex] || '/assets/images/dhreammarket.png'}
                alt={service.title}
                className="object-cover w-full h-full"
                fill
                priority
              />
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveGalleryIndex(Math.max(0, activeGalleryIndex - 1))}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setActiveGalleryIndex(Math.min(allImages.length - 1, activeGalleryIndex + 1))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {allImages.map((img: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveGalleryIndex(idx)}
                  className={`relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${idx === activeGalleryIndex ? 'border-royal-blue' : 'border-transparent'}`}
                >
                  <Image
                    src={img.imageUrl || img}
                    alt={`Gallery image ${idx + 1}`}
                    className="object-cover w-full h-full"
                    fill
                  />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="default" size="sm">
                  {service.category?.name}
                </Badge>
                <Badge variant={service.pricingType === 'CUSTOM_QUOTE' ? 'premium' : 'default'} size="sm">
                  {service.pricingType === 'FIXED_PRICE' ? 'Fixed Price' :
                   service.pricingType === 'STARTING_FROM' ? 'Starting From' :
                   service.pricingType === 'HOURLY' ? 'Hourly' : 'Custom Quote'}
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy mb-3">
                {service.title}
              </h1>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Link href={`/vendor/${service.store?.slug ?? service.store?.id}`} className="hover:text-royal-blue transition-colors flex items-center gap-1.5">
                  {service.store?.logo && (
                    <span className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden inline-block">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="12" fill={`url(#grad-${service.store.id})`} />
                      </svg>
                    </span>
                  )}
                  {service.store?.name}
                </Link>
                {badgeInfo && (
                  <span className={badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'}>
                    <MdVerified className="w-4 h-4 inline" />
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-premium-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {(service.store?.averageRating ?? 0).toFixed(1)} ({service.store?.reviewCount} reviews)
                </span>
              </div>
            </div>

            {/* Description */}
            {service.description && (
              <section className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="text-xl font-bold text-deep-navy mb-4">About This Service</h2>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {service.description}
                </p>
              </section>
            )}

            {/* Requirements */}
            {service.requirementsFromCustomer && (
              <section className="bg-white rounded-2xl p-8 shadow-sm">
                <h2 className="text-xl font-bold text-deep-navy mb-4">Requirements</h2>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {service.requirementsFromCustomer}
                </p>
              </section>
            )}

            {/* Pricing */}
            <section className="bg-white rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold text-deep-navy mb-4">Pricing</h2>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-royal-blue">
                  {formatPrice(effectivePrice)}
                </span>
                <span className="text-sm text-slate-500">
                  {service.pricingType === 'CUSTOM_QUOTE' ? 'Custom Quote' :
                   service.pricingType === 'HOURLY' ? '/ hour' : ''}
                </span>
              </div>
              {service.pricingType === 'STARTING_FROM' && (
                <p className="text-sm text-slate-500 mt-2">Starting from this price</p>
              )}
              {service.pricingType === 'CUSTOM_QUOTE' && (
                <p className="text-sm text-slate-500 mt-2">Contact the vendor for a custom quote</p>
              )}
            </section>

            {/* Details */}
            <section className="bg-white rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold text-deep-navy mb-4">Service Details</h2>
              <dl className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-600">Estimated Delivery</dt>
                  <dd className="font-medium text-deep-navy">{service.estimatedDeliveryTime || 'N/A'}</dd>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-600">Availability</dt>
                  <dd>
                    <Badge variant={
                      service.availabilityStatus === 'AVAILABLE' ? 'success' :
                      service.availabilityStatus === 'BUSY' ? 'warning' :
                      service.availabilityStatus === 'UNAVAILABLE' ? 'danger' : 'default'
                    } size="sm">
                      {service.availabilityStatus === 'AVAILABLE' ? 'Available' :
                       service.availabilityStatus === 'BUSY' ? 'Busy' :
                       service.availabilityStatus === 'UNAVAILABLE' ? 'Unavailable' : 'Temporarily Closed'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <dt className="text-slate-600">Delivery Type</dt>
                  <dd className="font-medium text-deep-navy">{service.deliveryType}</dd>
                </div>
              </dl>
            </section>

            {/* Contact & Request Quote */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="flex-1">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Contact Vendor
              </Button>
              {service.pricingType === 'CUSTOM_QUOTE' && (
                <Button variant="outline" size="lg" className="flex-1">
                  Request Quote
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Vendor Card */}
            <Card variant="elevated" className="p-6">
              <div className="flex items-center gap-3 mb-4">
                {service.store?.logo ? (
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100">
                    <Image src={service.store.logo} alt={service.store.name} className="object-cover w-full h-full" fill />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center text-white font-bold">
                    {service.store?.name?.charAt(0)?.toUpperCase() || 'V'}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-deep-navy">{service.store?.name}</h3>
                  <Link href={`/vendor/${service.store?.slug ?? service.store?.id}`} className="text-sm text-royal-blue hover:underline">
                    View Store
                  </Link>
                </div>
              </div>
              {service.store?.description && (
                <p className="text-sm text-slate-600 mb-4">{service.store.description}</p>
              )}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{service.store?.reviewCount} reviews</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Verified Vendor</span>
                </div>
              </div>
              <Button variant="outline" className="w-full mt-4" asChild>
                <Link href={`/vendor/${service.store?.slug ?? service.store?.id}`}>View Full Store</Link>
              </Button>
            </Card>

            {/* Category */}
            <Card variant="elevated" className="p-6">
              <h3 className="font-semibold text-deep-navy mb-3">Category</h3>
              <Link href={`/services/category/${service.category?.slug}`} className="text-royal-blue hover:underline">
                {service.category?.name}
              </Link>
            </Card>
          </div>
        </div>

        {/* Related Services */}
        {relatedServices.length > 0 && (
          <section className="mt-16 pt-12 border-t border-slate-200">
            <h2 className="text-2xl font-bold text-deep-navy mb-8">Related Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedServices
                .filter((s: RelatedService) => s.id !== service.id)
                .slice(0, 4)
                .map((related) => (
                  <Card key={related.id} variant="elevated" className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full">
                    <Link href={`/services/${related.slug}`} className="block">
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                        {related.thumbnail ? (
                          <Image src={related.thumbnail} alt={related.title} className="object-cover" fill loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100">
                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="p-4 flex flex-col flex-1">
                      <Link href={`/services/${related.slug}`} className="block">
                        <h3 className="text-sm font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors mb-2">
                          {related.title}
                        </h3>
                      </Link>
                      <div className="mt-auto">
                        <span className="text-sm font-bold text-royal-blue">{formatPrice(Number(related.startingPrice))}</span>
                        <p className="text-[11px] text-slate-500 mt-1">{related.store?.name}</p>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

