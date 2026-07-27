'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { formatPrice } from '@/lib/currency'
import { truncateVendorName } from '@/lib/utils'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { MdVerified } from 'react-icons/md'
import WishlistButton from '@/components/WishlistButton'
import { PricingType, AvailabilityStatus } from '@prisma/client'

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
}

interface ServiceCardProps {
  service: Service
  wishlistServiceIds?: Set<string>
}

const pricingTypeLabels: Record<string, string> = {
  FIXED_PRICE: 'Fixed Price',
  FIXED: 'Fixed Price',
  STARTING_FROM: 'Starting From',
  HOURLY: 'Hourly',
  CUSTOM_QUOTE: 'Custom Quote',
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

export default function ServiceCard({ service, wishlistServiceIds }: ServiceCardProps) {
  const badgeInfo = service.store ? getVendorBadgeInfo(service.store.badgeTier) : null
  const hasImage = service.thumbnail || (service.images && service.images.length > 0)
  const imageUrl = service.thumbnail || service.images?.[0]?.imageUrl

  return (
    <Card
      variant="elevated"
      className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full"
    >
      <Link href={`/services/${service.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          {hasImage ? (
            <Image
              src={imageUrl!}
              alt={service.title}
              className="object-cover w-full h-full"
              fill
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          )}
          {service.store && (
            <div className="absolute top-2 left-2">
              {badgeInfo ? (
                <Badge variant={badgeInfo.variant as any} size="sm">
                  {badgeInfo.displayLabel}
                </Badge>
              ) : service.store.isVerified ? (
                <Badge variant="verified" size="sm">Verified</Badge>
              ) : null}
            </div>
          )}
          <div className="absolute top-2 right-2">
            <WishlistButton
              productId={service.id}
              initialIsWishlisted={wishlistServiceIds?.has(service.id) ?? false}
              size="sm"
              className="bg-white/90"
            />
          </div>
        </div>
      </Link>
      <div className="p-3 flex flex-col flex-1">
        <Link href={`/services/${service.slug}`} className="block">
          <h3 className="text-sm font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight mb-1">
            {service.title}
          </h3>
        </Link>
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <Link href={`/vendor/${service.store.slug ?? service.store.id}`} className="block">
            <p className="text-[11px] text-slate-500 truncate hover:text-royal-blue transition-colors">
              {truncateVendorName(service.store.name)}
            </p>
          </Link>
          {badgeInfo ? (
            <MdVerified className={`w-3 h-3 flex-shrink-0 ${badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'}`} />
          ) : service.store.isVerified ? (
            <MdVerified className="w-3 h-3 text-sky-500 flex-shrink-0" />
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex items-center gap-0.5">
            <svg className="w-3 h-3 text-premium-gold" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-[11px] font-medium text-slate-600">
              {service.store.averageRating.toFixed(1)}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            ({service.store.reviewCount})
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-royal-blue">
            {formatPrice(Number(service.startingPrice))}
          </span>
          <Badge variant="default" size="sm" className="text-[9px]">
            {pricingTypeLabels[service.pricingType] || service.pricingType}
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {service.estimatedDeliveryTime || 'N/A'}
          </span>
          <Link href={`/services/${service.slug}`} className="w-full">
            <Button variant="outline" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
              View Service
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}

export { type ServiceCardProps, type Service }