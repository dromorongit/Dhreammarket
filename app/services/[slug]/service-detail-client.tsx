'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { truncateVendorName } from '@/lib/utils'
import { MdVerified } from 'react-icons/md'
import WishlistButton from '@/components/WishlistButton'
import { PricingType, AvailabilityStatus } from '@prisma/client'
import { getBlurDataURL, HERO_IMAGE_SIZES, VENDOR_LOGO_SIZES, CARD_IMAGE_SIZES } from '@/lib/image-utils'

interface RelatedService {
  id: string
  slug: string
  title: string
  startingPrice: number
  pricingType: string
  thumbnail: string | null
  images: Array<{ id: string; imageUrl: string; displayOrder: number }>
  store: { id: string; name: string; slug: string; isVerified: boolean; badgeTier: string | null }
  category: { id: string; name: string; slug: string }
}

interface ServiceDetailProps {
  serviceId: string
}

function getAvailabilityLabel(status: AvailabilityStatus): string {
  const labels: Record<string, string> = {
    AVAILABLE: 'Available',
    BUSY: 'Busy',
    UNAVAILABLE: 'Unavailable',
    TEMPORARILY_CLOSED: 'Temporarily Closed',
  }
  return labels[status] || status
}

function getAvailabilityVariant(status: AvailabilityStatus): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'AVAILABLE': return 'success'
    case 'BUSY': return 'warning'
    case 'UNAVAILABLE': return 'danger'
    case 'TEMPORARILY_CLOSED': return 'default'
    default: return 'default'
  }
}

function getPricingTypeLabel(pricingType: string): string {
  const labels: Record<string, string> = {
    FIXED_PRICE: 'Fixed Price',
    FIXED: 'Fixed Price',
    STARTING_FROM: 'Starting From',
    HOURLY: 'Hourly',
    CUSTOM_QUOTE: 'Custom Quote',
  }
  return labels[pricingType] || pricingType
}

function getPricingTypeVariant(pricingType: string): 'default' | 'premium' | 'info' {
  switch (pricingType) {
    case 'CUSTOM_QUOTE': return 'premium'
    case 'HOURLY': return 'info'
    default: return 'default'
  }
}

export default function ServiceDetail({ serviceId }: ServiceDetailProps) {
  const params = useParams()
  const slug = params!.slug as string
  const [service, setService] = useState<any>(null)
  const [relatedServices, setRelatedServices] = useState<RelatedService[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
  const [wishlistServiceIds, setWishlistServiceIds] = useState<Set<string>>(new Set())
  const [showFullDescription, setShowFullDescription] = useState(false)
  const addToCartButtonRef = useRef<HTMLButtonElement>(null)

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

  const handleShare = async () => {
    const url = window.location.href
    const title = service?.title ?? 'Service on Dhream Market'
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        navigator.clipboard.writeText(url)
      }
    } else {
      navigator.clipboard.writeText(url)
    }
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

  if (!service) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center py-12 px-4">
        <Card className="max-w-md w-full text-center">
          <CardContent>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rose-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.553 0 2.51-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.466 0L3.34 16c-.771 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-[#0F1F3D] mb-2">Service Not Found</h2>
            <p className="text-slate-600 mb-6">The service you are looking for does not exist or has been removed.</p>
            <Link href="/marketplace">
              <Button variant="primary" size="md" fullWidth>Back to Marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allImages = service.thumbnail ? [service.thumbnail, ...(service.gallery || [])] : (service.images || [])
  const effectivePrice = Number(service.startingPrice)
  const isCustomQuote = service.pricingType === 'CUSTOM_QUOTE'
  const badgeInfo = getVendorBadgeInfo(service.store?.badgeTier)
  const descriptionPreview = service.description && service.description.length > 150
    ? service.description.substring(0, 150).trim() + '...'
    : service.description ?? ''
  const currentImageIndex = allImages.findIndex((img: any) => img.imageUrl === (allImages[activeGalleryIndex]?.imageUrl || allImages[activeGalleryIndex]))
  const totalImages = allImages.length

  return (
    <div className="min-h-screen bg-[#F8F9FC] pb-20 md:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <nav className="flex items-center gap-1 text-xs md:text-sm mb-4 md:mb-6 overflow-x-auto">
          <Link href="/" className="text-slate-600 hover:text-[#1E40AF] whitespace-nowrap">Home</Link>
          <svg className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link href="/marketplace" className="text-slate-600 hover:text-[#1E40AF] whitespace-nowrap">Marketplace</Link>
          <svg className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          {service.category && (
            <>
              <Link href={`/services/category/${service.category.slug}`} className="text-slate-600 hover:text-[#1E40AF] whitespace-nowrap">
                {service.category.name}
              </Link>
              <svg className="w-3 h-3 md:w-4 md:h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </>
          )}
          <span className="text-[#0F1F3D] font-medium truncate max-w-[150px] md:max-w-xs">
            {service.title}
          </span>
        </nav>

        <div className="flex flex-col md:flex-row md:gap-8">
          <div className="w-full md:w-[55%]">
            <div className="relative bg-white rounded-xl md:rounded-2xl shadow-lg overflow-hidden mb-4">
              {allImages.length > 0 ? (
                <>
                  <div className="relative aspect-square">
                     <Image
                       src={allImages[activeGalleryIndex]?.imageUrl || allImages[activeGalleryIndex] || '/assets/images/dhreammarket.png'}
                       alt={service.title}
                       className="object-contain"
                       fill
                       priority
                       sizes={HERO_IMAGE_SIZES}
                       placeholder="blur"
                       blurDataURL={getBlurDataURL()}
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

            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 md:flex-wrap md:pb-0">
                {allImages.map((img: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveGalleryIndex(idx)}
                    className={`w-16 h-16 md:w-20 md:h-20 rounded-lg md:rounded-xl overflow-hidden border-2 flex-shrink-0 ${
                      idx === activeGalleryIndex ? 'border-[#1E40AF]' : 'border-slate-200'
                    }`}
                  >
                    <Image
                      src={img.imageUrl || img}
                      alt={`Gallery image ${idx + 1}`}
                      className="object-cover"
                      width={80}
                      height={80}
                      sizes={VENDOR_LOGO_SIZES}
                      placeholder="blur"
                      blurDataURL={getBlurDataURL()}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-full md:w-[45%] mt-6 md:mt-0">
            <div className="md:sticky md:top-24">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                {service.category && (
                  <Badge variant="info" size="sm">
                    {service.category.name}
                  </Badge>
                )}
                <Badge variant={getPricingTypeVariant(service.pricingType)} size="sm">
                  {getPricingTypeLabel(service.pricingType)}
                </Badge>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-[#0F1F3D] mb-3">
                {service.title}
              </h1>

              <div className="flex items-center gap-3 mb-4">
                <Link href={`/vendor/${service.store?.slug ?? service.store?.id}`} className="hover:text-[#1E40AF] transition-colors flex items-center gap-1.5">
                  {service.store?.logo && (
                    <span className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden inline-block">
                      <Image src={service.store.logo} alt={service.store.name} className="object-cover w-full h-full" width={24} height={24} sizes={VENDOR_LOGO_SIZES} placeholder="blur" blurDataURL={getBlurDataURL()} />
                    </span>
                  )}
                  <span className="text-sm text-slate-600">{service.store?.name}</span>
                </Link>
                {badgeInfo && (
                  <span className={badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'}>
                    <MdVerified className="w-4 h-4 inline" />
                  </span>
                )}
                <WishlistButton
                  productId={service.id}
                  initialIsWishlisted={wishlistServiceIds.has(service.id)}
                  size="md"
                />
              </div>

              <div className="mb-4">
                {isCustomQuote ? (
                  <span className="text-2xl md:text-3xl font-bold text-royal-blue">Request Quote</span>
                ) : (
                  <span className="text-2xl md:text-3xl font-bold text-royal-blue">
                    {formatPrice(effectivePrice)}
                  </span>
                )}
                {service.pricingType === 'CUSTOM_QUOTE' && (
                  <p className="text-sm text-slate-500 mt-1">Contact the vendor for a custom quote</p>
                )}
                {service.pricingType === 'STARTING_FROM' && !isCustomQuote && (
                  <p className="text-sm text-slate-500 mt-1">Starting from this price</p>
                )}
              </div>

              <div className="mb-6">
                <p className="text-slate-600 text-sm md:text-base leading-relaxed">
                  {showFullDescription ? service.description : descriptionPreview}
                </p>
                {service.description && service.description.length > 150 && (
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="text-xs md:text-sm text-[#1E40AF] font-medium mt-2 hover:underline"
                  >
                    {showFullDescription ? 'Show Less' : 'Show More'}
                  </button>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <Button
                  ref={addToCartButtonRef}
                  size="lg"
                  fullWidth
                  className="h-14 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-semibold text-base rounded-xl flex items-center justify-center gap-3 transition-all shadow-md hover:shadow-lg"
                  asChild
                >
                  <Link href={`/services/request?serviceId=${service.id}`}>
                    Book Service
                  </Link>
                </Button>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center gap-3">
                  {service.store?.logo ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                      <Image
                        src={service.store.logo}
                        alt={service.store.name}
                        className="object-cover w-full h-full"
                        width={48}
                        height={48}
                        sizes={VENDOR_LOGO_SIZES}
                        placeholder="blur"
                        blurDataURL={getBlurDataURL()}
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-700 font-bold text-lg">
                        {service.store?.name?.charAt(0)?.toUpperCase() || 'V'}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm md:text-base truncate">
                        {truncateVendorName(service.store?.name ?? 'Unknown Store')}
                      </span>
                      {badgeInfo && (
                        <span className={badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'}>
                          <MdVerified className="w-5 h-5" title={badgeInfo.displayLabel} />
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/vendor/${service.store?.slug ?? service.store?.id}`}
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
              onClick={() => {}}
              className={`pb-3 px-1 text-sm md:text-base font-medium transition-colors whitespace-nowrap text-[#1E40AF] border-b-2 border-[#1E40AF]`}
            >
              Details
            </button>
            <button
              onClick={handleShare}
              className="pb-3 px-1 text-sm md:text-base font-medium transition-colors whitespace-nowrap text-slate-600 hover:text-[#0F1F3D]"
            >
              Share
            </button>
          </div>

          <div className="min-h-[200px]">
            <div className="space-y-6">
              {service.requirementsFromCustomer && (
                <section className="bg-white rounded-2xl p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-deep-navy mb-4">Requirements</h2>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {service.requirementsFromCustomer}
                  </p>
                </section>
              )}

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
                      <Badge variant={getAvailabilityVariant(service.availabilityStatus as AvailabilityStatus)} size="sm">
                        {getAvailabilityLabel(service.availabilityStatus as AvailabilityStatus)}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <dt className="text-slate-600">Delivery Type</dt>
                    <dd className="font-medium text-deep-navy">{service.deliveryType}</dd>
                  </div>
                </dl>
              </section>

              {service.tags && service.tags.length > 0 && (
                <section className="bg-white rounded-2xl p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-deep-navy mb-4">Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {service.tags.map((tag: string) => (
                      <Badge key={tag} variant="default" size="sm">{tag}</Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        {relatedServices.length > 0 && (
          <section className="mt-16 pt-12 border-t border-slate-200">
            <h2 className="text-2xl font-bold text-deep-navy mb-8">Related Services</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedServices
                .filter((s: RelatedService) => s.id !== service.id)
                .slice(0, 4)
                .map((related) => (
                  <Card key={related.id} variant="elevated" className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0">
                    <Link href={`/services/${related.slug}`} className="block">
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden -m-px">
                        {related.thumbnail ? (
                          <Image src={related.thumbnail} alt={related.title} className="object-cover" fill loading="lazy" sizes={CARD_IMAGE_SIZES} placeholder="blur" blurDataURL={getBlurDataURL()} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-100">
                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="p-2 space-y-1 flex-1 flex flex-col">
                      <Link href={`/services/${related.slug}`} className="block">
                        <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
                          {related.title}
                        </h3>
                      </Link>
                      <div className="mt-auto flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[10px] text-slate-500 truncate min-w-0">
                            {truncateVendorName(related.store?.name ?? '')}
                          </p>
                          {related.store?.isVerified && (
                            <MdVerified className="w-3 h-3 text-sky-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-royal-blue">
                            {related.pricingType === 'CUSTOM_QUOTE' ? 'Request Quote' : formatPrice(Number(related.startingPrice))}
                          </span>
                          <Link href={`/services/${related.slug}`} className="w-full">
                            <Button variant="primary" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">View Service</Button>
                          </Link>
                        </div>
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