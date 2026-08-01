'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Skeleton } from '@/components/Skeleton'

interface AIVendorInsightItem {
  id: string
  name: string
  slug: string
  score: number
  reason: string
}

interface AIVendorInsightGroup {
  type: string
  items: AIVendorInsightItem[]
}

interface AIVendorInsightsProps {
  vendorId: string
  userId: string
  title?: string
}

export function AIVendorInsights({ vendorId, userId, title }: AIVendorInsightsProps) {
  const [insights, setInsights] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch(`/api/ai/vendor-insights`)
        if (response.ok) {
          const data = await response.json()
          setInsights(data.insights)
        }
      } catch (error) {
        console.error('Error fetching vendor insights:', error)
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
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (!insights) {
    return null
  }

  const insightGroups: AIVendorInsightGroup[] = [
    { type: 'Suggested Products to Add', items: insights.suggestedProductsToAdd?.[0]?.items ?? [] },
    { type: 'High Performing Products', items: insights.highPerformingProducts?.[0]?.items ?? [] },
    { type: 'Low Performing Products', items: insights.lowPerformingProducts?.[0]?.items ?? [] },
    { type: 'Price Improvements', items: insights.suggestedPriceImprovements?.[0]?.items ?? [] },
    { type: 'Inventory Restock', items: insights.suggestedInventoryRestock?.[0]?.items ?? [] },
  ]

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-deep-navy">{title ?? 'Vendor Intelligence'}</h3>

      {insightGroups.map((group) => (
        <Card key={group.type} variant="elevated" className="p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">{group.type}</h4>
          {group.items.length === 0 ? (
            <p className="text-sm text-slate-400">No insights available yet</p>
          ) : (
            <div className="space-y-2">
              {group.items.map((item: AIVendorInsightItem) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <Link href={`/marketplace/product/${item.slug}`} className="text-sm font-medium text-royal-blue hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-xs text-slate-500 mt-0.5">{item.reason}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.score * 100}%`,
                          backgroundColor: item.score > 0.7 ? '#22c55e' : item.score > 0.4 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}