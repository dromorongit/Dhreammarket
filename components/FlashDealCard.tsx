'use client'

import { useState, useEffect } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import { Badge } from './Badge'
import { StarRating } from './StarRating'

interface FlashDealProps {
  deal: {
    id: string
    title: string
    description?: string | null
    discountType: string
    discountValue: number
    maxDiscount?: number | null
    startDate: string
    endDate: string
    products?: any[]
  }
}

export function FlashDealCard({ deal }: FlashDealProps) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const updateTimeLeft = () => {
      const now = new Date()
      const endDate = new Date(deal.endDate)
      const diff = endDate.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeLeft('Ended')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [deal.endDate])

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 p-4 text-white">
        <h3 className="font-bold text-lg">{deal.title}</h3>
        {deal.description && (
          <p className="text-sm opacity-90 mt-1">{deal.description}</p>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Badge variant="danger">
            {deal.discountType === 'PERCENTAGE' ? `${deal.discountValue}% OFF` : `$${deal.discountValue} OFF`}
          </Badge>
          <span className="text-sm font-mono text-red-600 font-bold">{timeLeft}</span>
        </div>
        {deal.products && deal.products.length > 0 && (
          <div className="space-y-2">
            {deal.products.slice(0, 3).map((product: any) => (
              <div key={product.id} className="flex items-center justify-between text-sm">
                <span className="line-clamp-1">{product.name}</span>
                <span className="font-bold text-royal-blue">
                  ${(product.dealPrice || product.salesPrice || product.price).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Button variant="primary" size="sm" className="w-full mt-3">
          View Deal
        </Button>
      </div>
    </Card>
  )
}