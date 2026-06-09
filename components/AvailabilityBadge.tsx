import { Badge } from '@/components/Badge'
import { cn } from '@/lib/utils'

interface AvailabilityBadgeProps {
  availabilityType?: string
  stock?: number
  expectedArrivalDate?: string | null
  expectedRestockDate?: string | null
  className?: string
  showDate?: boolean
}

export function AvailabilityBadge({ availabilityType, stock, expectedArrivalDate, expectedRestockDate, className, showDate = false }: AvailabilityBadgeProps) {
  if (!availabilityType) return null

  if (availabilityType === 'PREORDER') {
    return (
      <div className="relative">
        <Badge variant="preorder" size="sm" className={cn('absolute top-2 right-2 text-[10px] px-1.5 py-0.5 z-10', className)}>
          PREORDER
        </Badge>
        {showDate && expectedArrivalDate && (
          <div className="absolute top-8 right-2 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full z-10 max-w-[120px] truncate">
            Arrives {new Date(expectedArrivalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    )
  }

  if (availabilityType === 'BACKORDER') {
    return (
      <div className="relative">
        <Badge variant="backorder" size="sm" className={cn('absolute top-2 right-2 text-[10px] px-1.5 py-0.5 z-10', className)}>
          BACKORDER
        </Badge>
        {showDate && expectedRestockDate && (
          <div className="absolute top-8 right-2 bg-orange-100 text-orange-800 text-[10px] px-1.5 py-0.5 rounded-full z-10 max-w-[120px] truncate">
            Restocks {new Date(expectedRestockDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>
    )
  }

  if (availabilityType === 'IN_STOCK' && stock === 0) {
    return (
      <div className={cn('absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10', className)}>
        Sold Out
      </div>
    )
  }

  return null
}