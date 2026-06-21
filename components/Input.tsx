import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  wrapperClassName?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, wrapperClassName, icon, ...props }, ref) => {
    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        {label && (
          <label className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
className={cn(
               'block w-full rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-base md:text-sm text-slate-900 placeholder-slate-400',
               'focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue',
               'hover:border-slate-300 hover:bg-white',
               'transition-all duration-200 shadow-sm hover:shadow',
               icon && 'pl-12',
               error && 'border-rose-300 focus:ring-rose-500/50 focus:border-rose-500',
               props.disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
               className
             )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-rose-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'