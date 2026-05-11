'use client'

import { useRouter } from 'next/navigation'
import { Button } from './Button'

interface NeedHelpButtonProps {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  category?: string
  className?: string
  children?: React.ReactNode
  fullWidth?: boolean
}

export default function NeedHelpButton({
  variant = 'primary',
  size = 'md',
  category = 'GENERAL',
  className = '',
  children,
  fullWidth = false,
}: NeedHelpButtonProps) {
  const router = useRouter()

  const handleClick = () => {
    const helpCenterUrl = `/help-center?type=${encodeURIComponent(category)}`
    router.push(helpCenterUrl)
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={`${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {children || (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Need Help?
        </>
      )}
    </Button>
  )
}
