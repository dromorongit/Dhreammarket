import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'default' | 'glass' | 'elevated' | 'outline'
  padding?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Card({ className, children, variant = 'default', padding = 'lg', ...props }: CardProps) {
  const variantClasses = {
    default: 'bg-white border border-slate-200 shadow-sm',
    glass: 'bg-white/60 backdrop-blur-xl border border-white/20 shadow-premium',
    elevated: 'bg-white border border-slate-200/50 shadow-premium-lg hover:shadow-premium-xl transition-shadow duration-300',
    outline: 'bg-transparent border border-slate-200',
  }

  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  }

  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-300',
        variantClasses[variant],
        paddingClasses[padding],
        variant === 'elevated' && 'hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

Card.Header = CardHeader
Card.Content = CardContent
Card.Footer = CardFooter

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('mb-6', className)} {...props}>
      {children}
    </div>
  )
}

export function CardContent({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('mt-6 pt-6 border-t border-slate-100', className)} {...props}>
      {children}
    </div>
  )
}