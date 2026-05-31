'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { formatPrice } from '@/lib/currency'
import NeedHelpButton from '@/components/NeedHelpButton'

interface OrderItem {
  id: string
  quantity: number
  price: number
  color?: string | null
  size?: string | null
  age?: string | null
  product: {
    id: string
    name: string
  }
}

interface Payment {
  id: string
  amount: number
  status: string
  reference: string
  createdAt: string
}

interface Order {
  id: string
  total: number
  status: string
  paymentStatus: string
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  payment: Payment | null
  vendorTotal: number
  user: {
    id: string
    email: string
    profile: {
      firstName: string | null
      lastName: string | null
      phone: string | null
      address: string | null
    } | null
  }
}

// Order status configuration for vendor fulfillment workflow
const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'Pending', description: 'Awaiting processing', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  PROCESSING: { label: 'Processing', description: 'Preparing order', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  SHIPPED: { label: 'Shipped', description: 'In transit', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  DELIVERED: { label: 'Delivered', description: 'Out for delivery', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  COMPLETED: { label: 'Completed', description: 'Order complete', color: 'bg-green-100 text-green-800 border-green-300' },
  CANCELLED: { label: 'Cancelled', description: 'Order cancelled', color: 'bg-red-100 text-red-800 border-red-300' },
}

// Status progression for vendors
const STATUS_PROGRESSION = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

export default function VendorOrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail()
    }
  }, [orderId])

  const fetchOrderDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/vendor/orders/${orderId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load order')
        return
      }
      
      const data = await response.json()
      setOrder(data.order)
    } catch (err) {
      console.error('Error fetching order detail:', err)
      setError('An error occurred while loading the order')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return
    
    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/vendor/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to update status')
        return
      }

      const data = await response.json()
      setOrder((prev) => prev ? { ...prev, status: data.order.status, updatedAt: data.order.updatedAt } : null)
    } catch (err) {
      console.error('Error updating order status:', err)
      alert('Failed to update order status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Render fulfillment status progression
  const renderFulfillmentProgress = () => {
    if (!order) return null

    const currentStatusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
    if (!currentStatusConfig) return null

    const currentIndex = STATUS_PROGRESSION.indexOf(order.status)
    const isCancelled = order.status === 'CANCELLED'

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Fulfillment Progress</h3>
        
        {/* Progress Steps */}
        {!isCancelled && (
          <div className="flex items-center justify-between mb-4">
            {STATUS_PROGRESSION.map((status, index) => {
              const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]
              const isActive = index <= currentIndex
              const isCurrent = status === order.status
              
              return (
                <div key={status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        isActive 
                          ? isCurrent
                            ? 'bg-orange-600 text-white ring-4 ring-orange-100'
                            : 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className={`text-xs mt-1 font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                      {config.label}
                    </span>
                  </div>
                  {index < STATUS_PROGRESSION.length - 1 && (
                    <div 
                      className={`flex-1 h-1 mx-2 rounded transition-all ${
                        index < currentIndex ? 'bg-orange-300' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Current Status Display */}
        <div className={`p-4 rounded-lg border-2 ${currentStatusConfig.color}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{currentStatusConfig.label}</p>
              <p className="text-sm opacity-80">{currentStatusConfig.description}</p>
            </div>
            <div className="text-right text-sm">
              <p className="opacity-70">Last updated</p>
              <p className="font-medium">
                {new Date(order.updatedAt).toLocaleDateString('en-GH', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Status Update Controls */}
        {!isCancelled && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update Order Status
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUS_PROGRESSION.map((status) => {
                const config = ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG]
                const isCurrentStatus = status === order.status
                const statusIndex = STATUS_PROGRESSION.indexOf(status)
                const canAdvance = statusIndex > currentIndex && statusIndex === currentIndex + 1
                
                return (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={isCurrentStatus || !canAdvance || updatingStatus}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isCurrentStatus
                        ? 'bg-orange-600 text-white cursor-default'
                        : canAdvance
                        ? 'bg-white border-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isCurrentStatus ? `✓ ${config.label}` : config.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click on the next status in the progression to advance the order.
            </p>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="animate-pulse">
              <p className="text-gray-600">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href="/dashboard/vendor">
                <Button>Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
              <p className="text-gray-600 mb-6">The order you're looking for doesn't exist.</p>
              <Link href="/dashboard/vendor">
                <Button>Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const orderDate = new Date(order.createdAt)
  const formattedDate = orderDate.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const renderVariantInfo = (item: OrderItem) => {
    const parts = []
    if (item.color) parts.push(`Color: ${item.color}`)
    if (item.size) parts.push(`Size: ${item.size}`)
    if (item.age) parts.push(`Age: ${item.age}`)
    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/dashboard/vendor" 
            className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Orders
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Order Details</h1>

        {/* Order Info Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
              <div>
                <p className="text-sm text-gray-500">Order Reference</p>
                <p className="text-lg font-semibold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
              </div>
              <div className="mt-4 sm:mt-0 text-left sm:text-right">
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="text-gray-900">{formattedDate}</p>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-3 mb-4">
              <div>
                <span className="text-xs text-gray-500 mr-2">Payment:</span>
                <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  PAID
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 mr-2">Order:</span>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'
                }`}>
                  {ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]?.label || order.status}
                </span>
              </div>
            </div>

            {/* Fulfillment Progress */}
            {renderFulfillmentProgress()}

            {/* Vendor Total */}
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Your Items Total</span>
                <span className="text-2xl font-bold text-gray-900">{formatPrice(order.vendorTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Your Items in This Order</h2>
          </CardHeader>
          <CardContent>
            {order.items.length === 0 ? (
              <p className="text-gray-600">No items from your store in this order.</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {order.items.map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {item.product.name}{renderVariantInfo(item)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Quantity: {item.quantity} × {formatPrice(item.price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Customer Email</p>
                <p className="text-gray-900">{order.user.email}</p>
              </div>
              {(order.user.profile?.firstName || order.user.profile?.lastName) && (
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="text-gray-900">
                    {[order.user.profile?.firstName, order.user.profile?.lastName].filter(Boolean).join(' ')}
                  </p>
                </div>
              )}
              {order.user.profile?.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="text-gray-900">{order.user.profile.phone}</p>
                </div>
              )}
              {order.user.profile?.address && (
                <div>
                  <p className="text-sm text-gray-500">Delivery Address</p>
                  <p className="text-gray-900">{order.user.profile.address}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/dashboard/vendor" className="flex-1">
              <Button variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            </Link>
            <Link href="/dashboard/vendor/products" className="flex-1">
              <Button className="w-full">
                Manage Products
              </Button>
            </Link>
          </div>
          <NeedHelpButton
            variant="outline"
            size="sm"
            category="ORDER"
            fullWidth
          />
        </div>
      </div>
    </div>
  )
}