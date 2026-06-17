import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'premium' | 'verified' | 'preorder' | 'backorder' | 'trusted-vendor' | 'premium-vendor' | 'platinum-vendor'
  size?: 'sm' | 'md' | 'lg'
  rounded?: boolean
}

export function Badge({
  variant = 'default',
  size = 'md',
  rounded = true,
  className,
  children,
  ...props
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-slate-200 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border border-amber-200',
    danger: 'bg-rose-100 text-rose-700 border border-rose-200',
    info: 'bg-blue-100 text-blue-700 border border-blue-200',
    premium: 'bg-gradient-to-r from-premium-gold/20 to-yellow-100 text-premium-gold border border-premium-gold/30',
    verified: 'bg-gradient-to-r from-royal-blue/20 to-blue-100 text-royal-blue border border-royal-blue/30',
    preorder: 'bg-blue-600 text-white',
    backorder: 'bg-orange-500 text-white',
    'trusted-vendor': 'bg-blue-100 text-blue-700 border border-blue-200',
    'premium-vendor': 'bg-gradient-to-r from-yellow-400/20 to-amber-100 text-amber-700 border border-amber-300',
    'platinum-vendor': 'bg-gradient-to-r from-slate-300/30 to-gray-200 text-slate-700 border border-slate-300',
  }

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
    md: 'px-2.5 py-1 text-xs font-semibold uppercase tracking-wider',
    lg: 'px-3 py-1.5 text-sm font-semibold uppercase tracking-wider',
  }

  const roundedClass = rounded ? 'rounded-full' : 'rounded-md'

  const getBadgeIcon = () => {
    switch (variant) {
      case 'verified':
      case 'trusted-vendor':
      case 'premium-vendor':
      case 'platinum-vendor':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
        )
      case 'premium':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        variantClasses[variant],
        sizeClasses[size],
        roundedClass,
        className
      )}
      {...props}
    >
      {variant === 'verified' && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
      )}
      {variant === 'premium' && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
        </svg>
      )}
      {(variant === 'trusted-vendor' || variant === 'premium-vendor' || variant === 'platinum-vendor') && getBadgeIcon()}
      {children}
    </span>
  )
}