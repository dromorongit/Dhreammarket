'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
  }
  availabilityType?: string | null
  expectedArrivalDate?: string | null
  expectedRestockDate?: string | null
}

interface FulfillmentOrder {
  id: string
  orderNumber: string
  customer: string
  customerEmail: string
  product: string
  orderType: string
  fulfillmentStatus: string
  nextStatus: string | null
  expectedDate: string | null
  createdAt: string
  daysOutstanding: number
}

const FULFILLMENT_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  AWAITING_STOCK: { label: 'Awaiting Stock', color: 'bg-amber-100 text-amber-800' },
  AWAITING_RESTOCK: { label: 'Awaiting Restock', color: 'bg-orange-100 text-orange-800' },
  READY_TO_FULFILL: { label: 'Ready to Fulfill', color: 'bg-cyan-100 text-cyan-800' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: 'Delivered', color: 'bg-indigo-100 text-indigo-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
}

const FULFILLMENT_TRANSITIONS: Record<string, string> = {
  AWAITING_STOCK: 'READY_TO_FULFILL',
  AWAITING_RESTOCK: 'READY_TO_FULFILL',
  READY_TO_FULFILL: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
}

export default function VendorFulfillmentPageClient() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
  const [analytics, setAnalytics] = useState<{
    preorderCount: number
    backorderCount: number
    overdueCount: number
    avgFulfillmentDays: number
    readyToFulfillCount: number
    allocatedToday: number
  } | null>(null)

  useEffect(() => {
    fetchFulfillmentOrders()
    fetchAnalytics()
  }, [filter])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/vendor/fulfillment/analytics')
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (err) {
      console.error('Error fetching fulfillment analytics:', err)
    }
  }

  const fetchFulfillmentOrders = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/vendor/fulfillment?filter=${filter}`)

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load fulfillment orders')
        return
      }

      const data = await response.json()
      setOrders(data.orders || [])
    } catch (err) {
      console.error('Error fetching fulfillment orders:', err)
      setError('An error occurred while loading fulfillment orders')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingOrders(prev => new Set(prev).add(orderId))

    try {
      const response = await fetch(`/api/vendor/fulfillment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, fulfillmentStatus: newStatus }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to update fulfillment status')
        return
      }

      await fetchFulfillmentOrders()
    } catch (err) {
      console.error('Error updating fulfillment status:', err)
      alert('Failed to update fulfillment status')
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Orders</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Button asChild>
                <Link href="/dashboard/vendor">Return to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/vendor"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Pre-orders & Backorders</h1>
          <p className="text-gray-600 mt-1">Manage your pre-order and backorder fulfillment</p>
        </div>

        {/* Fulfillment Alerts */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
            <Card className="bg-cyan-50 border-cyan-200">
              <CardContent className="p-4">
                <p className="text-sm text-cyan-600 font-medium">Pre-orders</p>
                <p className="text-2xl font-bold text-cyan-700">{analytics.preorderCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <p className="text-sm text-orange-600 font-medium">Backorders</p>
                <p className="text-2xl font-bold text-orange-700">{analytics.backorderCount}</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-4">
                <p className="text-sm text-emerald-600 font-medium">Ready to Fulfill</p>
                <p className="text-2xl font-bold text-emerald-700">{analytics.readyToFulfillCount}</p>
              </CardContent>
            </Card>
            {analytics.overdueCount > 0 && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="p-4">
                  <p className="text-sm text-red-600 font-medium">Overdue</p>
                  <p className="text-2xl font-bold text-red-700">{analytics.overdueCount}</p>
                </CardContent>
              </Card>
            )}
            <Card className="bg-slate-50 border-slate-200">
              <CardContent className="p-4">
                <p className="text-sm text-slate-600 font-medium">Avg. Fulfillment</p>
                <p className="text-2xl font-bold text-slate-700">{analytics.avgFulfillmentDays}d</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-48 rounded-2xl border border-slate-200 bg-white px-4 py-2"
              >
                <option value="all">All Orders</option>
                <option value="preorder">Pre-orders Only</option>
                <option value="backorder">Backorders Only</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No fulfillment orders</h3>
              <p className="text-gray-600">
                {filter === 'all'
                  ? "You don't have any pre-orders or backorders to fulfill yet."
                  : `No ${filter} orders found.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusConfig = FULFILLMENT_STATUS_CONFIG[order.fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_CONFIG]
              const nextStatus = FULFILLMENT_TRANSITIONS[order.fulfillmentStatus]
              const isUpdating = updatingOrders.has(order.id)

              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusConfig?.color || 'bg-gray-100 text-gray-800'}`}>
                            {statusConfig?.label || order.fulfillmentStatus}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            order.orderType === 'PREORDER' ? 'bg-cyan-100 text-cyan-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {order.orderType === 'PREORDER' ? 'Pre-Order' : 'Back-Order'}
                          </span>
                        </div>
                        <p className="font-medium text-gray-900">{order.customer}</p>
                        <p className="text-sm text-gray-600">{order.customerEmail}</p>
                        <p className="text-sm text-gray-600 mt-1">{order.product}</p>
                        {order.expectedDate && (
                          <p className="text-xs text-gray-500 mt-1">Expected: {order.expectedDate}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(order.createdAt).toLocaleDateString('en-GH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })} • {order.daysOutstanding} days outstanding
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {nextStatus && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, nextStatus)}
                            disabled={isUpdating}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                          >
                            {isUpdating ? 'Updating...' : `Mark as ${FULFILLMENT_STATUS_CONFIG[nextStatus as keyof typeof FULFILLMENT_STATUS_CONFIG]?.label?.split(' ')[0] || nextStatus}`}
                          </button>
                        )}
                        <Link href={`/dashboard/vendor/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
