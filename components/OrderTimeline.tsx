'use client'

import { cn } from '@/lib/utils'

interface TimelineStep {
  key: string
  label: string
  description?: string
}

interface FulfillmentEvent {
  id: string
  eventType: string
  title: string
  description: string | null
  createdAt: string
}

interface OrderTimelineProps {
  currentStatus: string
  orderType?: 'NORMAL' | 'PREORDER' | 'BACKORDER'
  fulfillmentStatus?: string
  expectedDate?: string | null
  fulfillmentEvents?: FulfillmentEvent[]
  className?: string
}

const ORDER_STEPS: TimelineStep[] = [
  { key: 'PENDING', label: 'Order Placed', description: 'Order received and queued' },
  { key: 'AWAITING_STOCK', label: 'Waiting for Stock', description: 'Item pending inventory arrival' },
  { key: 'AWAITING_RESTOCK', label: 'Waiting for Restock', description: 'Item pending supplier restock' },
  { key: 'READY_TO_FULFILL', label: 'Ready to Fulfill', description: 'Preparing for shipment' },
  { key: 'PROCESSING', label: 'Processing', description: 'Order being prepared' },
  { key: 'SHIPPED', label: 'Shipped', description: 'Order in transit' },
  { key: 'DELIVERED', label: 'Delivered', description: 'Order completed' },
]

const STATUS_ORDER = ['PENDING', 'AWAITING_STOCK', 'AWAITING_RESTOCK', 'READY_TO_FULFILL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

export function OrderTimeline({
  currentStatus,
  orderType = 'NORMAL',
  fulfillmentStatus,
  expectedDate,
  className,
}: OrderTimelineProps) {
  const getCurrentStepIndex = (): number => {
    if (currentStatus === 'CANCELLED' || currentStatus === 'COMPLETED') {
      if (currentStatus === 'COMPLETED') return STATUS_ORDER.indexOf('DELIVERED')
      return -1
    }

    if (fulfillmentStatus && orderType !== 'NORMAL') {
      const fulfillmentIndex = STATUS_ORDER.indexOf(fulfillmentStatus)
      if (fulfillmentIndex >= 0) return fulfillmentIndex
    }

    return STATUS_ORDER.indexOf(currentStatus)
  }

  const currentStep = getCurrentStepIndex()

  if (currentStep < 0) {
    return null
  }

  const getStepStatus = (index: number): 'completed' | 'current' | 'pending' => {
    if (index < currentStep) return 'completed'
    if (index === currentStep) return 'current'
    return 'pending'
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="relative">
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 md:block hidden" />
        <div 
          className="absolute top-3 left-0 h-0.5 bg-orange-600 -translate-y-1/2 transition-all duration-500 md:block hidden"
          style={{ width: `${(currentStep / (ORDER_STEPS.length - 1)) * 100}%` }}
        />
        
        <div className="relative flex flex-col md:flex-row md:justify-between gap-4 md:gap-0">
          {ORDER_STEPS.map((step, index) => {
            const status = getStepStatus(index)
            const isCurrent = status === 'current'
            
            return (
              <div key={step.key} className="flex items-center gap-3 md:flex-col md:items-center md:flex-1">
                <div 
                  className={cn(
                    'w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium z-10 flex-shrink-0',
                    'border-2 transition-all duration-300',
                    status === 'completed' && 'bg-orange-600 border-orange-600 text-white',
                    status === 'current' && 'bg-white border-orange-600 text-orange-600 shadow-lg',
                    status === 'pending' && 'bg-gray-100 border-gray-200 text-gray-400'
                  )}
                >
                  {status === 'completed' ? (
                    <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="md:mt-2 md:text-center">
                  <p className={cn(
                    'text-xs md:text-xs font-medium',
                    isCurrent ? 'text-orange-600' : status === 'completed' ? 'text-gray-900' : 'text-gray-500'
                  )}>
                    {step.label}
                  </p>
                  {isCurrent && step.description && (
                    <p className="text-[10px] text-gray-500 mt-1 hidden md:block">{step.description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {expectedDate && (orderType === 'PREORDER' || orderType === 'BACKORDER') && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-amber-800">
                {orderType === 'PREORDER' ? 'Expected Arrival' : 'Expected Restock'}
              </p>
              <p className="text-xs text-amber-700">
                {new Date(expectedDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function FulfillmentProgress({
  fulfillmentStatus,
  className,
}: {
  fulfillmentStatus: string
  className?: string
}) {
  const progressMap: Record<string, number> = {
    PENDING: 5,
    AWAITING_STOCK: 15,
    AWAITING_RESTOCK: 15,
    READY_TO_FULFILL: 35,
    PROCESSING: 55,
    SHIPPED: 75,
    DELIVERED: 90,
    CANCELLED: 0,
  }

  const progress = progressMap[fulfillmentStatus] ?? 0

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-700">Fulfillment Progress</span>
        <span className="text-xs font-semibold text-orange-600">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

interface EventTimelineProps {
  events: FulfillmentEvent[]
  className?: string
}

export function EventTimeline({ events, className }: EventTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className={cn('text-center py-8 text-gray-500', className)}>
        <p className="text-sm">No events recorded yet</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {index < events.length - 1 && (
              <div className="w-0.5 h-8 bg-gray-200 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>
            {event.description && (
              <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              {new Date(event.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}