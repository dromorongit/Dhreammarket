import { ButtonHTMLAttributes, forwardRef, cloneElement, ReactElement } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gradient' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  fullWidth?: boolean
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, loading, fullWidth, asChild, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-royal-blue focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none relative overflow-hidden group'

    const sizeClasses = {
      sm: 'px-4 py-2 text-sm rounded-xl',
      md: 'px-6 py-3 text-base rounded-2xl',
      lg: 'px-8 py-4 text-lg rounded-2xl',
      xl: 'px-10 py-5 text-xl rounded-3xl',
    }

    const variantClasses = {
      primary: 'bg-gradient-to-r from-royal-blue to-deep-navy text-white shadow-lg shadow-royal-blue/25 hover:shadow-xl hover:shadow-royal-blue/35 hover:scale-[1.02] active:scale-[0.98] border border-royal-blue/20',
      secondary: 'bg-slate-50 text-dark-text hover:bg-slate-100 shadow-sm hover:shadow-md border border-slate-200',
      outline: 'border-2 border-royal-blue/30 bg-white/50 text-royal-blue hover:bg-royal-blue/5 hover:border-royal-blue hover:shadow-lg hover:shadow-royal-blue/10 backdrop-blur-sm',
      ghost: 'text-slate-700 hover:bg-slate-100 hover:text-royal-blue',
      gradient: 'bg-gradient-to-r from-royal-blue via-purple-500 to-premium-gold text-white shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/35 hover:scale-[1.02] active:scale-[1] border border-white/20',
      danger: 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/35 hover:scale-[1.02] active:scale-[0.98] border border-rose-500/20',
      success: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-[0.98] border border-emerald-500/20',
    }

    const combinedClasses = cn(
      baseClasses,
      sizeClasses[size],
      variantClasses[variant],
      fullWidth && 'w-full',
      loading && 'cursor-wait',
      className
    )

    if (asChild && children) {
      return cloneElement(children as ReactElement, {
        className: cn(combinedClasses, (children as ReactElement).props?.className),
        disabled: loading || props.disabled,
        ...props,
      })
    }

    return (
      <button
        ref={ref}
        className={combinedClasses}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        <span className={loading ? 'opacity-70' : ''}>{children}</span>
      </button>
    )
  }
)

Button.displayName = 'Button'