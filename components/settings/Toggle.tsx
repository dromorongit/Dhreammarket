'use client'

import { useState } from 'react'

interface ToggleProps {
  checked?: boolean
  defaultChecked?: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  className?: string
}

export default function Toggle({ checked, defaultChecked, onChange, label, description, disabled, className }: ToggleProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const value = isControlled ? checked : internalChecked

  const handleToggle = () => {
    if (!isControlled) {
      setInternalChecked(!internalChecked)
    }
    onChange(!value)
  }
  return (
    <div className={`flex items-center justify-between py-2 ${className || ''}`}>
      <div className="flex-1">
        {label && <p className="text-sm font-medium text-slate-900">{label}</p>}
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={handleToggle}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-royal-blue focus:ring-offset-2
          ${value ? 'bg-royal-blue' : 'bg-slate-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out
            ${value ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  )
}
