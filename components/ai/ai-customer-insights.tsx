'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface AICustomerInsightsProps {
  userId: string
  title?: string
}

interface InsightCategory {
  category: string
  type: string
  items: Array<{
    id: string
    name: string
    slug: string
    count: number
    lastInteractedAt: string
  }>
  score: number
}

export function AICustomerInsights({ userId, title }: AICustomerInsightsProps) {
  const [insights, setInsights] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch(`/api/ai/customer-insights?limit=10`)
        if (response.ok) {
          const data = await response.json()
          setInsights(data.insights)
        }
      } catch (error) {
        console.error('Error fetching customer insights:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (!insights) {
    return null
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-deep-navy">{title ?? 'Your Shopping Insights'}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card variant="elevated" className="p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Favorite Categories</h4>
          <div className="space-y-2">
            {insights.categoryInterests?.slice(0, 5).map((cat: InsightCategory) => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{cat.category}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-royal-blue rounded-full" style={{ width: `${cat.score * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-500">{cat.items[0]?.count ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card variant="elevated" className="p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Favorite Brands</h4>
          <div className="space-y-2">
            {insights.brandInterests?.slice(0, 5).map((brand: InsightCategory) => (
              <div key={brand.category} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{brand.category}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-premium-gold rounded-full" style={{ width: `${brand.score * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-500">{brand.items[0]?.count ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card variant="elevated" className="p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-royal-blue">{insights.recentlyViewed?.length ?? 0}</p>
            <p className="text-xs text-slate-500">Items Viewed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{insights.recentlyPurchased?.length ?? 0}</p>
            <p className="text-xs text-slate-500">Purchases</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{insights.recentlyBooked?.length ?? 0}</p>
            <p className="text-xs text-slate-500">Bookings</p>
          </div>
        </div>
      </Card>
    </div>
  )
}