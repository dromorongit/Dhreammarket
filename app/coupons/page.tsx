'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatPrice } from '@/lib/currency'

interface Coupon {
  id: string
  code: string
  type: string
  value: number
  currency: string
  minSpend?: number
  maxDiscount?: number
  expiryDate: string
  isActive: boolean
  description?: string
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      const response = await fetch('/api/coupons?public=true')
      if (response.ok) {
        const data = await response.json()
        setCoupons(data.coupons || [])
      }
    } catch (error) {
      console.error('Error fetching coupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-deep-navy mb-8">Coupons & Deals</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
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
          <h1 className="text-4xl font-bold text-deep-navy mb-4">Coupons & Deals</h1>
          <p className="text-gray-500">Save money with our latest coupons and promotional offers</p>
        </div>

        {coupons.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-gray-500 mb-4">No active coupons at the moment</p>
            <Button onClick={() => window.location.href = '/marketplace'}>Browse Products</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((coupon) => {
              const expired = isExpired(coupon.expiryDate)
              const discountText = coupon.type === 'PERCENTAGE'
                ? `${coupon.value}% Off`
                : coupon.type === 'FIXED_AMOUNT'
                ? `${coupon.currency} ${coupon.value} Off`
                : 'Free Delivery'

              return (
                <Card key={coupon.id} variant="elevated" className={`overflow-hidden ${expired ? 'opacity-60' : ''}`}>
                  <div className="bg-gradient-to-r from-royal-blue to-purple-600 text-white p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white/80 mb-1">Discount</p>
                        <p className="text-3xl font-bold">{discountText}</p>
                      </div>
                      <Badge variant={expired ? 'danger' : 'success'} size="lg">
                        {expired ? 'Expired' : 'Active'}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-deep-navy mb-2">Code: {coupon.code}</h3>
                    {coupon.description && <p className="text-sm text-gray-600 mb-4">{coupon.description}</p>}
                    <div className="space-y-2 text-sm text-gray-500 mb-4">
                      {coupon.minSpend && <p>Minimum spend: {coupon.currency} {coupon.minSpend}</p>}
                      {coupon.maxDiscount && <p>Max discount: {coupon.currency} {coupon.maxDiscount}</p>}
                      <p>Expires: {new Date(coupon.expiryDate).toLocaleDateString()}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => copyToClipboard(coupon.code)}
                      disabled={expired}
                    >
                      {copiedCode === coupon.code ? 'Copied!' : 'Copy Code'}
                    </Button>
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
