'use client'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'

interface PointsCardProps {
  balance: number
  totalEarned: number
  totalRedeemed: number
}

export function PointsCard({ balance, totalEarned, totalRedeemed }: PointsCardProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-deep-navy">Reward Points</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-3xl font-bold text-royal-blue">{balance.toLocaleString()}</span>
            <p className="text-xs text-gray-500 mt-1">Available Points</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-green-700">{totalEarned.toLocaleString()}</p>
              <p className="text-xs text-green-600">Total Earned</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-red-700">{totalRedeemed.toLocaleString()}</p>
              <p className="text-xs text-red-600">Total Redeemed</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}