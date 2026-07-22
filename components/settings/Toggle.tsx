'use client'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  className?: string
}

export default function Toggle({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  return (
    <div className={`flex items-center justify-between py-2 ${className || ''}`}>
      <div className="flex-1">
        {label && <p className="text-sm font-medium text-slate-900">{label}</p>}
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-royal-blue focus:ring-offset-2
          ${checked ? 'bg-royal-blue' : 'bg-slate-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  )
}
