'use client'

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { StarRating } from '@/components/StarRating'

interface FlashDeal {
  id: string
  title: string
  description?: string
  discountType: string
  discountValue: number
  maxDiscount?: number
  startDate: string
  endDate: string
  products: {
    id: string
    dealPrice: number
    product?: {
      id: string
      name: string
      price: number
      images: { url: string }[]
      store: { name: string; averageRating: number; reviewCount: number }
    }
    service?: {
      id: string
      title: string
      startingPrice: number
      images: { url: string }[]
      store: { name: string; averageRating: number; reviewCount: number }
    }
  }[]
}

export default function FlashDealsPage() {
  const [deals, setDeals] = useState<FlashDeal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeals()
  }, [])

  const fetchDeals = async () => {
    try {
      const response = await fetch('/api/flash-deals')
      if (response.ok) {
        const data = await response.json()
        setDeals(data.deals || [])
      }
    } catch (error) {
      console.error('Error fetching flash deals:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTimeRemaining = (endDate: string) => {
    const total = Date.parse(endDate) - Date.parse(new Date().toISOString())
    if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    return {
      days: Math.floor(total / (1000 * 60 * 60 * 24)),
      hours: Math.floor((total / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((total / 1000 / 60) % 60),
      seconds: Math.floor((total / 1000) % 60),
    }
  }

  const isActive = (deal: FlashDeal) => {
    const now = new Date()
    const start = new Date(deal.startDate)
    const end = new Date(deal.endDate)
    return now >= start && now <= end
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-deep-navy mb-8">Flash Deals</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-6 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-deep-navy mb-4">Flash Deals</h1>
          <p className="text-gray-500">Limited time offers on amazing products and services</p>
        </div>

        {deals.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-gray-500 mb-4">No active flash deals at the moment</p>
            <Link href="/marketplace">
              <Button>Browse Products</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-12">
            {deals.map((deal) => {
              const timeRemaining = getTimeRemaining(deal.endDate)
              const dealActive = isActive(deal)

              return (
                <Card key={deal.id} variant="elevated" className="overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-500 to-orange-500 text-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-bold mb-1">{deal.title}</h2>
                        {deal.description && <p className="text-white/80">{deal.description}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-white/80 mb-1">Ends in</p>
                        <div className="flex gap-2">
                          <div className="bg-white/20 rounded-lg px-3 py-1">
                            <span className="block text-lg font-bold">{timeRemaining.days}</span>
                            <span className="text-xs">Days</span>
                          </div>
                          <div className="bg-white/20 rounded-lg px-3 py-1">
                            <span className="block text-lg font-bold">{timeRemaining.hours}</span>
                            <span className="text-xs">Hours</span>
                          </div>
                          <div className="bg-white/20 rounded-lg px-3 py-1">
                            <span className="block text-lg font-bold">{timeRemaining.minutes}</span>
                            <span className="text-xs">Mins</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-4">
                      <Badge variant={dealActive ? 'success' : 'warning'}>
                        {dealActive ? 'Live Now' : 'Upcoming'}
                      </Badge>
                      <span className="text-white/90">
                        {deal.discountType === 'PERCENTAGE' ? `${deal.discountValue}% Off` : `GHS ${deal.discountValue} Off`}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {deal.products.map((item) => {
                        const product = item.product
                        const service = item.service
                        const entity = product || service
                        const originalPrice = product?.price || service?.startingPrice || 0
                        const dealPrice = item.dealPrice || originalPrice * (1 - deal.discountValue / 100)

                        return (
                          <Card key={item.id} variant="outline" className="overflow-hidden">
                            <div className="aspect-[4/3] bg-gray-100 relative">
                              {entity?.images?.[0] ? (
                                <img src={entity.images[0].url} alt={product?.name || service?.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              <Badge variant="danger" className="absolute top-2 left-2">
                                {deal.discountType === 'PERCENTAGE' ? `${deal.discountValue}% OFF` : `GHS ${deal.discountValue} OFF`}
                              </Badge>
                            </div>
                            <div className="p-4">
                              <h3 className="font-semibold text-deep-navy text-sm line-clamp-2 mb-1">
                                {product?.name || service?.title}
                              </h3>
                              <p className="text-xs text-gray-500 mb-2">{entity?.store?.name}</p>
                              <div className="flex items-center gap-2 mb-3">
                                <StarRating rating={entity?.store?.averageRating || 0} size="sm" />
                                <span className="text-xs text-gray-500">({entity?.store?.reviewCount || 0})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-rose-600">GHS {dealPrice.toFixed(2)}</span>
                                <span className="text-sm text-gray-500 line-through">GHS {originalPrice.toFixed(2)}</span>
                              </div>
                              <Link href={product ? `/marketplace/product/${product.id}` : `/services/${service?.id}`}>
                                <Button size="sm" className="w-full mt-3">View Deal</Button>
                              </Link>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
