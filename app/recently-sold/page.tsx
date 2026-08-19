'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

interface SoldItem {
  id: string
  name: string
  price: number
  quantity: number
  images?: { url: string }[]
  type: string
}

export default function RecentlySoldPage() {
  const [items, setItems] = useState<SoldItem[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')

  useEffect(() => {
    fetchRecentlySold()
  }, [period])

  const fetchRecentlySold = async () => {
    try {
      const response = await fetch(`/api/recently-sold?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.recentlySold || [])
      }
    } catch (error) {
      console.error('Error fetching recently sold:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-deep-navy mb-8">Recently Sold</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Recently Sold</h1>
            <p className="text-gray-500 mt-1">See what others are buying on Dhream Market</p>
          </div>
          <div className="flex gap-2">
            {['today', 'week', 'month'].map((p) => (
              <Button
                key={p}
                variant={period === p ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </Button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-gray-500">No sales recorded for this period yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <Card key={item.id} variant="elevated" className="overflow-hidden group">
                <Link href={item.type === 'PRODUCT' ? `/marketplace/product/${item.id}` : `/services/${item.id}`}>
                  <div className="aspect-square bg-gray-100 relative">
                    {item.images?.[0] ? (
                      <Image src={getOptimizedCloudinaryUrl(item.images[0].url, 400)} alt={item.name} className="object-cover" fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"  unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <Badge variant="success" className="absolute top-2 left-2">
                      {item.quantity} sold
                    </Badge>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-deep-navy line-clamp-2 mb-1">{item.name}</h3>
                    <p className="text-sm font-bold text-royal-blue">GHS {item.price.toFixed(2)}</p>
                  </div>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
