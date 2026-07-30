'use client'

import { useState, useEffect } from 'react'
import { Card } from './Card'
import { Button } from './Button'

interface ExitIntentPopupProps {
  onClose: () => void
  onAction: () => void
  title?: string
  message?: string
  couponCode?: string
}

export function ExitIntentPopup({ onClose, onAction, title = 'Wait! Don\'t leave!', message = 'Check out our latest deals before you go.', couponCode }: ExitIntentPopupProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 0) {
        setVisible(true)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [])

  if (!visible) return null

  const handleClose = () => {
    setVisible(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <Card variant="elevated" className="max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          ×
        </button>
        <h3 className="text-xl font-bold text-deep-navy mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
        {couponCode && (
          <div className="bg-royal-blue/10 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-600">Use code:</p>
            <p className="text-lg font-bold text-royal-blue">{couponCode}</p>
          </div>
        )}
        <Button onClick={onAction} className="w-full">
          Take Me There
        </Button>
      </Card>
    </div>
  )
}