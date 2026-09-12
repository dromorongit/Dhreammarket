'use client'

interface NonReturnableBadgeProps {
  isReturnable?: boolean
  className?: string
}

export default function NonReturnableBadge({ isReturnable, className }: NonReturnableBadgeProps) {
  if (isReturnable !== false) {
    return null
  }

  return (
    <div className={`flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2.5 py-1.5 ${className || ''}`}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 9l-.732-2.28A2 2 0 0115.567 7H18a2 2 0 012 2v5a2 2 0 01-2 2h-5l-1 1-1-1H9a2 2 0 01-2-2V7a2 2 0 012-2h2.432l1.132 2.707c.77 1.333-.192 2.541-1.732 3z" />
      </svg>
      <span className="text-xs font-semibold">This product is not returnable</span>
    </div>
  )
}
