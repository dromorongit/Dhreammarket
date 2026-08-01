'use client'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'

interface CashbackCardProps {
  balance: number
  totalEarned: number
  totalRedeemed: number
}

export function CashbackCard({ balance, totalEarned, totalRedeemed }: CashbackCardProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-deep-navy">Cashback</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-center">
            <span className="text-3xl font-bold text-emerald-600">{balance.toFixed(2)}</span>
            <p className="text-xs text-gray-500 mt-1">Available Cashback (GHS)</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-green-700">{totalEarned.toFixed(2)}</p>
              <p className="text-xs text-green-600">Total Earned</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="font-semibold text-red-700">{totalRedeemed.toFixed(2)}</p>
              <p className="text-xs text-red-600">Total Redeemed</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}