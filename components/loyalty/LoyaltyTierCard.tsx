'use client'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'

interface LoyaltyTierCardProps {
  tier: {
    id: string
    name: string
    slug: string
    color: string
    minPoints: number
    maxPoints: number | null
    multiplier: number
    cashbackRate: number
    description: string | null
  } | null
  points: number
}

export function LoyaltyTierCard({ tier, points }: LoyaltyTierCardProps) {
  if (!tier) {
    return (
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-deep-navy">Loyalty Tier</h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No tier assigned yet</p>
        </CardContent>
      </Card>
    )
  }

  const nextTierMin = tier.maxPoints ? tier.maxPoints + 1 : null
  const progressPercent = nextTierMin
    ? Math.min((points / nextTierMin) * 100, 100)
    : 100

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-deep-navy">Loyalty Tier</h3>
          <Badge style={{ backgroundColor: tier.color, color: '#fff' }}>
            {tier.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Points</span>
              <span className="font-medium text-deep-navy">{points.toLocaleString()}</span>
            </div>
            {nextTierMin && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: tier.color,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {nextTierMin - points} points to next tier
                </p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Multiplier</span>
              <p className="font-medium">{tier.multiplier}x</p>
            </div>
            <div>
              <span className="text-gray-500">Cashback Rate</span>
              <p className="font-medium">{(tier.cashbackRate * 100).toFixed(1)}%</p>
            </div>
          </div>
          {tier.description && (
            <p className="text-xs text-gray-500">{tier.description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}