import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  wrapperClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, wrapperClassName, ...props }, ref) => {
    return (
      <div className={cn('space-y-2', wrapperClassName)}>
        {label && (
          <label className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            'block w-full rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-slate-900 placeholder-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue',
            'hover:border-slate-300 hover:bg-white',
            'transition-all duration-200 shadow-sm hover:shadow',
            'resize-none',
            error && 'border-rose-300 focus:ring-rose-500/50 focus:border-rose-500',
            props.disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
            className
          )}
          {...props}
        />
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
Textarea.displayName = 'Textarea'