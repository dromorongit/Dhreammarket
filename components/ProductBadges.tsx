import { Badge } from '@/components/Badge'

export interface ProductBadgeData {
  discountPercentage?: number
  isFlashSale?: boolean
  isSponsored?: boolean
  isFeatured?: boolean
  availabilityType?: string
  expectedArrivalDate?: string | null
  expectedRestockDate?: string | null
  stock?: number
}

interface ProductBadgesProps {
  product: ProductBadgeData
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ProductBadges({ product, className, size = 'sm' }: ProductBadgesProps) {
  const {
    discountPercentage,
    isFlashSale,
    isSponsored,
    isFeatured,
    availabilityType,
    expectedArrivalDate,
    expectedRestockDate,
    stock,
  } = product

if (!discountPercentage && !isFlashSale && !isSponsored && !isFeatured &&
    !availabilityType && !(availabilityType === 'IN_STOCK' && (stock ?? 0) === 0)) {
  return null
}

  const leftBadges = []

  if (discountPercentage > 0) {
    leftBadges.push({
      key: 'discount',
      type: 'discount',
      content: `-${discountPercentage}%`,
    })
  }

  if (isFlashSale) {
    leftBadges.push({
      key: 'flash-sale',
      type: 'flash-sale',
      content: 'FLASH SALE',
      variant: 'danger' as const,
    })
  }

  if (isSponsored) {
    leftBadges.push({
      key: 'sponsored',
      type: 'sponsored',
      content: 'SPONSORED',
      variant: 'warning' as const,
    })
  }

  if (isFeatured) {
    leftBadges.push({
      key: 'featured',
      type: 'featured',
      content: 'FEATURED',
      variant: 'premium' as const,
    })
  }

  const rightBadges = []

  if (availabilityType === 'PREORDER') {
    rightBadges.push({
      key: 'preorder',
      content: 'PREORDER',
    })
    if (expectedArrivalDate) {
      rightBadges.push({
        key: 'arrival',
        type: 'date',
        content: `Arrives ${new Date(expectedArrivalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        variant: 'arrival' as const,
      })
    }
  }

  if (availabilityType === 'BACKORDER') {
    rightBadges.push({
      key: 'backorder',
      content: 'BACKORDER',
    })
    if (expectedRestockDate) {
      rightBadges.push({
        key: 'restock',
        type: 'date',
        content: `Restocks ${new Date(expectedRestockDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        variant: 'restock' as const,
      })
    }
  }

  if (availabilityType === 'IN_STOCK' && (stock ?? 0) === 0) {
    rightBadges.push({
      key: 'sold-out',
      type: 'sold-out',
      content: 'Sold Out',
    })
  }

  return (
    <>
      {leftBadges.length > 0 && (
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
          {leftBadges.map(badge => {
            if (badge.type === 'discount') {
              return (
                <div key={badge.key} className="bg-rose-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                  {badge.content}
                </div>
              )
            }
            return (
              <Badge key={badge.key} variant={badge.variant} size={size} className="text-[10px] px-1.5 py-0.5">
                {badge.content}
              </Badge>
            )
          })}
        </div>
      )}

      {rightBadges.length > 0 && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
          {rightBadges.map(badge => {
            if (badge.type === 'sold-out') {
              return (
                <div key={badge.key} className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {badge.content}
                </div>
              )
            }
            if (badge.type === 'date') {
              const bg = badge.variant === 'arrival' ? 'amber' : 'orange'
              return (
                <div key={badge.key} className={`bg-${bg}-50 text-${bg}-800 text-[10px] px-1.5 py-0.5 rounded-full border border-${bg}-200`}>
                  {badge.content}
                </div>
              )
            }
            const variant = badge.key === 'preorder' ? 'preorder' : 'backorder'
            return (
              <Badge key={badge.key} variant={variant} size={size} className="text-[10px] px-1.5 py-0.5">
                {badge.content}
              </Badge>
            )
          })}
        </div>
      )}
    </>
  )
}

export function calculateProductBadges(product: {
  price: number
  flashSalePrice?: number | null
  salesPrice?: number | null
  dealsPrice?: number | null
  stock?: number
  availabilityType?: string
  expectedArrivalDate?: string | null
  expectedRestockDate?: string | null
  isSponsored?: boolean
  isFeatured?: boolean
}): ProductBadgeData {
  const effectivePrice = product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice ?? product.price
  const hasSpecialPrice = (product.dealsPrice ?? product.salesPrice ?? product.flashSalePrice) != null
  const discountPercentage = hasSpecialPrice && product.price > effectivePrice
    ? Math.round(((product.price - effectivePrice) / product.price) * 100)
    : 0
  const isFlashSale = !!(product.flashSalePrice && product.flashSalePrice < product.price)

  return {
    discountPercentage,
    isFlashSale,
    isSponsored: product.isSponsored ?? false,
    isFeatured: product.isFeatured ?? false,
    availabilityType: product.availabilityType,
    expectedArrivalDate: product.expectedArrivalDate,
    expectedRestockDate: product.expectedRestockDate,
    stock: product.stock ?? 0,
  }
}