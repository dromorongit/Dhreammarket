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
import { PricingType } from '@prisma/client'
import { getBlurDataURL, CARD_IMAGE_SIZES } from '@/lib/image-utils'

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

interface ServiceCardProps {
  service: Service
  wishlistServiceIds?: Set<string>
  className?: string
}

function getPricingLabel(pricingType: string): string {
  const labels: Record<string, string> = {
    FIXED_PRICE: 'Fixed Price',
    FIXED: 'Fixed Price',
    STARTING_FROM: 'Starting From',
    HOURLY: 'Hourly',
    CUSTOM_QUOTE: 'Custom Quote',
  }
  return labels[pricingType] || pricingType
}

import { memo } from 'react'

export default memo(function ServiceCard({ service, wishlistServiceIds, className }: ServiceCardProps) {
  const badgeInfo = service.store ? getVendorBadgeInfo(service.store.badgeTier) : null
  const hasImage = service.thumbnail || (service.images && service.images.length > 0)
  const imageUrl = service.thumbnail || service.images?.[0]?.imageUrl
  const isCustomQuote = service.pricingType === 'CUSTOM_QUOTE'

  return (
    <Card
      variant="elevated"
      className={`group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300 h-full p-0 ${className || ''}`}
    >
      <Link href={`/services/${service.slug}`} className="block">
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden -m-px">
          {hasImage ? (
            <Image
              src={imageUrl!}
              alt={service.title}
              className="object-cover w-full h-full"
              fill
              loading="lazy"
              sizes={CARD_IMAGE_SIZES}
              placeholder="blur"
              blurDataURL={getBlurDataURL()}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          )}
          {service.category && (
            <div className="absolute top-2 left-2">
              <Badge variant="info" size="sm">
                {service.category.name}
              </Badge>
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
      <div className="p-2 space-y-1 flex-1 flex flex-col">
        <Link href={`/services/${service.slug}`} className="block">
          <h3 className="text-xs font-semibold text-deep-navy line-clamp-2 group-hover:text-royal-blue transition-colors leading-tight">
            {service.title}
          </h3>
        </Link>
        <span className="text-[11px] font-bold text-royal-blue">
          {isCustomQuote ? 'Request Quote' : formatPrice(Number(service.startingPrice))}
        </span>
        <Link href={`/services/${service.slug}`} className="w-full">
          <Button variant="primary" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
            View Service
          </Button>
        </Link>
        <Link href={`/services/request?serviceId=${service.id}`} className="w-full">
          <Button variant="outline" size="sm" className="w-full h-7 text-[11px] px-2 py-1 rounded-lg">
            Book Service
          </Button>
        </Link>
        <div className="flex items-center gap-1.5 min-w-0">
          {service.store && (
            <p className="text-[10px] text-slate-500 truncate min-w-0">
              {truncateVendorName(service.store.name)}
            </p>
          )}
          {badgeInfo ? (
            <span className={badgeInfo.tier === 'PLATINUM' ? 'text-slate-700' : badgeInfo.tier === 'PREMIUM' ? 'text-premium-gold' : 'text-sky-500'}>
              <MdVerified className="w-3 h-3 flex-shrink-0" />
            </span>
          ) : service.store?.isVerified ? (
            <MdVerified className="w-3 h-3 text-sky-500 flex-shrink-0" />
          ) : null}
        </div>
      </div>
     </Card>
   )
 })

export { type ServiceCardProps, type Service }