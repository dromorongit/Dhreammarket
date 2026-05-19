import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'rounded' | 'circular' | 'text'
  className?: string
}

export function Skeleton({
  variant = 'default',
  className,
  ...props
}: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-lg',
    rounded: 'rounded-xl',
    circular: 'rounded-full',
    text: 'rounded-lg w-full',
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-100',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
    </div>
  )
}

// Compound components for common skeleton patterns
export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <Skeleton variant="rounded" className="aspect-[4/3] w-full" />
      <div className="p-2.5 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-2/5 mt-1.5" />
        <div className="flex flex-col gap-1 mt-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === 0 ? 'w-3/4' : i === 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}