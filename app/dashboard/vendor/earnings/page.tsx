'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface OrderItemEarnings {
  id: string
  orderId: string
  productId: string
  quantity: number
  price: number
  grossAmount: number
  processorFee: number | null
  netAmount: number | null
  platformCommission: number
  vendorEarnings: number
  commissionRate: number
  createdAt: string
  product: {
    name: string
  }
  order: {
    id: string
    createdAt: string
    paymentStatus: string
  }
}

interface Payout {
  id: string
  amount: number
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED'
  reference?: string
  note?: string
  paidAt?: string
  createdAt: string
}

export default function VendorEarningsPage() {
  const [earnings, setEarnings] = useState<OrderItemEarnings[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutSummary, setPayoutSummary] = useState<{ totalPaid: number; totalPending: number; totalProcessing: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'earnings' | 'payouts'>('earnings')

  const fetchEarnings = useCallback(async () => {
    try {
      const response = await fetch('/api/vendor/earnings')
      if (response.ok) {
        const data = await response.json()
        setEarnings(data.earnings || [])
      } else {
        setError('Failed to load earnings')
      }
    } catch (err) {
      console.error('Error fetching earnings:', err)
      setError('Failed to load earnings')
    }
  }, [])

  const fetchPayouts = useCallback(async () => {
    try {
      const response = await fetch('/api/vendor/payouts/me')
      if (response.ok) {
        const data = await response.json()
        setPayouts(data.payouts || [])
        setPayoutSummary(data.summary || null)
      } else {
        setError('Failed to load payouts')
      }
    } catch (err) {
      console.error('Error fetching payouts:', err)
      setError('Failed to load payouts')
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      await Promise.all([fetchEarnings(), fetchPayouts()])
      setLoading(false)
    }
    fetchData()
  }, [fetchEarnings, fetchPayouts])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getPayoutStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  // Calculate totals
  const totalGross = earnings.reduce((sum, item) => sum + item.grossAmount, 0)
  const totalCommission = earnings.reduce((sum, item) => sum + item.platformCommission, 0)
  const totalEarnings = earnings.reduce((sum, item) => sum + item.vendorEarnings, 0)
  const totalPaid = payoutSummary?.totalPaid ?? 0
  const totalPending = payoutSummary?.totalPending ?? 0

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="Error Loading Earnings"
            description={error}
          >
            <Button onClick={() => window.location.reload()} variant="primary">
              Try Again
            </Button>
          </EmptyState>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-deep-navy">Earnings & Payouts</h1>
          <p className="text-slate-600 mt-1">Track your earnings and payout history</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card variant="elevated">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Total Gross Sales</p>
              <p className="text-2xl font-bold text-deep-navy">{formatPrice(totalGross)}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Platform Commission</p>
              <p className="text-2xl font-bold text-royal-blue">{formatPrice(totalCommission)}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Your Earnings</p>
              <p className="text-2xl font-bold text-emerald-600">{formatPrice(totalEarnings)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payout Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card variant="elevated">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Total Paid Out</p>
              <p className="text-2xl font-bold text-emerald-600">{formatPrice(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Pending Payouts</p>
              <p className="text-2xl font-bold text-amber-600">{formatPrice(totalPending)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('earnings')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              activeTab === 'earnings'
                ? 'bg-royal-blue text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Earnings History
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              activeTab === 'payouts'
                ? 'bg-royal-blue text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Payout History
          </button>
        </div>

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <Card variant="elevated">
            <CardContent className="p-0">
              {earnings.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="No Earnings Yet"
                  description="Your earnings will appear here when you make sales."
                />
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block md:hidden divide-y divide-gray-200">
                    {earnings.map((item) => (
                      <div key={item.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">#{item.orderId.slice(-8)}</p>
                            <p className="text-sm text-gray-500">{item.product.name}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Gross:</span>
                            <span className="ml-1">{formatPrice(item.grossAmount)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Commission:</span>
                            <span className="ml-1 text-royal-blue">{formatPrice(item.platformCommission)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Your Earnings:</span>
                            <span className="ml-1 font-medium text-emerald-600">{formatPrice(item.vendorEarnings)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <span className="ml-1">{formatDate(item.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Order</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Gross</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Commission</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Your Earnings</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {earnings.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="font-medium text-deep-navy">#{item.orderId.slice(-8)}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-slate-700">{item.product.name}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-slate-700">{formatPrice(item.grossAmount)}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-royal-blue">{formatPrice(item.platformCommission)}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="font-medium text-emerald-600">{formatPrice(item.vendorEarnings)}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                              {formatDate(item.createdAt)}
                            </td>
                          </tr>
                        ))}
                       </tbody>
                     </table>
                   </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payouts Tab */}
        {activeTab === 'payouts' && (
          <Card variant="elevated">
            <CardContent className="p-0">
              {payouts.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6m5 4h6" />
                    </svg>
                  }
                  title="No Payouts Yet"
                  description="Payouts will appear here when the platform processes your earnings."
                />
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="block md:hidden divide-y divide-gray-200">
                    {payouts.map((payout) => (
                      <div key={payout.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{formatPrice(payout.amount)}</p>
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPayoutStatusBadge(payout.status)}`}>
                            {payout.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <span className="ml-1">{formatDate(payout.createdAt)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Paid:</span>
                            <span className="ml-1">{payout.paidAt ? formatDate(payout.paidAt) : '-'}</span>
                          </div>
                        </div>
                        {payout.note && (
                          <div className="text-sm">
                            <span className="text-gray-500">Note:</span>
                            <span className="ml-1">{payout.note}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Paid Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {payouts.map((payout) => (
                          <tr key={payout.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="font-medium text-deep-navy">{formatPrice(payout.amount)}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge className={getPayoutStatusBadge(payout.status)}>
                                {payout.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                              {formatDate(payout.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                              {payout.paidAt ? formatDate(payout.paidAt) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                              {payout.note || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}