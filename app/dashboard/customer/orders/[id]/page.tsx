'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { formatPrice } from '@/lib/currency'
import NeedHelpButton from '@/components/NeedHelpButton'
import { EventTimeline } from '@/components/OrderTimeline'
import { Textarea } from '@/components/Textarea'
import { Badge } from '@/components/Badge'

interface OrderItem {
  id: string
  quantity: number
  price: number
  color?: string | null
  size?: string | null
  age?: string | null
  availabilityType?: string | null
  expectedArrivalDate?: string | null
  expectedRestockDate?: string | null
  product: {
    id: string
    name: string
    images: Array<{
      id: string
      url: string
      alt: string | null
    }>
  }
}

interface Payment {
  id: string
  amount: number
  status: string
  reference: string
  paystackRef: string | null
  createdAt: string
}

interface Order {
  id: string
  total: number
  status: string
  paymentStatus: string
  orderType: string
  fulfillmentStatus: string
  vendorAccepted: boolean
  vendorRejected: boolean
  vendorRejectionReason?: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  payment: Payment | null
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

interface FulfillmentEvent {
  id: string
  eventType: string
  title: string
  description: string | null
  createdAt: string
}

interface OrderMessage {
  id: string
  userId: string
  userRole: string
  message: string
  messageType: string
  isRead: boolean
  createdAt: string
  user: {
    id: string
    email: string
    profile?: {
      firstName: string | null
      lastName: string | null
    } | null
  }
}

const VENDOR_ACCEPTANCE_CONFIG = {
  ACCEPTED: { label: 'Accepted by Vendor', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected by Vendor', color: 'bg-red-100 text-red-800' },
  PENDING: { label: 'Awaiting Vendor Acceptance', color: 'bg-yellow-100 text-yellow-800' },
}

// Order status configuration for timeline display
const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'Order Placed', color: 'bg-amber-100 text-amber-700', step: 0 },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700', step: 1 },
  SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-700', step: 2 },
  DELIVERED: { label: 'Delivered', color: 'bg-indigo-100 text-indigo-700', step: 3 },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', step: 4 },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-800', step: -1 },
}

const FULFILLMENT_STEPS: Record<string, { label: string; percentage: number }> = {
  PENDING: { label: 'Order Placed', percentage: 5 },
  AWAITING_STOCK: { label: 'Awaiting Stock', percentage: 15 },
  AWAITING_RESTOCK: { label: 'Awaiting Restock', percentage: 15 },
  READY_TO_FULFILL: { label: 'Ready to Fulfill', percentage: 35 },
  PROCESSING: { label: 'Processing', percentage: 55 },
  SHIPPED: { label: 'Shipped', percentage: 75 },
  DELIVERED: { label: 'Delivered', percentage: 90 },
}

// Fulfillment status configuration
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

const PAYMENT_STATUS_CONFIG = {
  PENDING: { label: 'Pending Payment', color: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  REFUNDED: { label: 'Refunded', color: 'bg-gray-100 text-gray-800' },
}

export default function CustomerOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [events, setEvents] = useState<FulfillmentEvent[]>([])
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail()
      fetchEvents()
      fetchMessages()
    }
  }, [orderId])

  const fetchOrderDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/orders/${orderId}`)
      
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

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true)
      const response = await fetch(`/api/orders/${orderId}/events`)
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events)
      }
    } catch (err) {
      console.error('Error fetching fulfillment events:', err)
    } finally {
      setLoadingEvents(false)
    }
  }

  const fetchMessages = async () => {
    try {
      setLoadingMessages(true)
      const response = await fetch(`/api/orders/${orderId}/messages`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages)
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSendMessage = async (type: 'GENERAL' | 'REFUND_REQUEST' = 'GENERAL', messageContent?: string) => {
    const contentToSend = messageContent || newMessage
    if (!contentToSend.trim()) return

    setSendingMessage(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contentToSend,
          messageType: type,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to send message')
        return
      }

      const data = await response.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage('')
      setShowRefundDialog(false)
      setRefundReason('')
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleRefundRequest = () => {
    if (!refundReason.trim()) return
    handleSendMessage('REFUND_REQUEST', `Refund Request: ${refundReason}`)
  }

  const renderMessages = () => {
    if (loadingMessages) {
      return <p className="text-sm text-gray-500">Loading messages...</p>
    }

    return (
      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages yet. Contact the vendor below.</p>
        ) : (
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {messages.map((msg) => {
              const userName = msg.user.profile?.firstName 
                ? `${msg.user.profile.firstName} ${msg.user.profile.lastName || ''}`.trim()
                : msg.user.email.split('@')[0]
              const isCustomer = msg.userRole === 'CUSTOMER'
              
              return (
                <div key={msg.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    isCustomer ? 'bg-royal-blue text-white' : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-xs font-medium mb-1">{userName}</p>
                    <p className="text-sm">{msg.message}</p>
                    {msg.messageType !== 'GENERAL' && (
                      <Badge 
                        variant={msg.messageType === 'REFUND_REQUEST' ? 'warning' : msg.messageType === 'REFUND_APPROVAL' ? 'success' : 'danger'} 
                        size="sm" 
                        className="mt-1"
                      >
                        {msg.messageType === 'REFUND_REQUEST' ? 'Refund Request' : 
                         msg.messageType === 'REFUND_APPROVAL' ? 'Refund Approved' : 'Refund Rejected'}
                      </Badge>
                    )}
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

// Render order status timeline/progress
   const renderOrderProgress = () => {
    if (!order) return null
    
    const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
    if (!statusConfig || statusConfig.step < 0) return null

    const steps = [
      { key: 'PENDING', ...ORDER_STATUS_CONFIG.PENDING },
      { key: 'PROCESSING', ...ORDER_STATUS_CONFIG.PROCESSING },
      { key: 'SHIPPED', ...ORDER_STATUS_CONFIG.SHIPPED },
      { key: 'DELIVERED', ...ORDER_STATUS_CONFIG.DELIVERED },
    ]

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Order Progress</h3>
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= statusConfig.step 
                      ? 'bg-orange-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index + 1}
                </div>
                <span className={`text-xs mt-1 ${index <= statusConfig.step ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div 
                  className={`flex-1 h-1 mx-2 ${
                    index < statusConfig.step ? 'bg-orange-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderFulfillmentProgress = () => {
    if (!order || order.orderType === 'NORMAL') return null
    
    const fulfillmentStep = FULFILLMENT_STEPS[order.fulfillmentStatus as keyof typeof FULFILLMENT_STEPS]
    if (!fulfillmentStep) return null
    
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Fulfillment Progress</span>
          <span className="text-sm font-semibold text-orange-600">{fulfillmentStep.percentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
            style={{ width: `${fulfillmentStep.percentage}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">{fulfillmentStep.label}</p>
      </div>
    )
  }

  const renderVariantInfo = (item: OrderItem) => {
    const parts = []
    if (item.color) parts.push(`Color: ${item.color}`)
    if (item.size) parts.push(`Size: ${item.size}`)
    if (item.age) parts.push(`Age: ${item.age}`)
    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href="/dashboard/customer">
                <Button>Return to My Orders</Button>
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
              <p className="text-gray-600 mb-6">The order you&apos;re looking for doesn&apos;t exist.</p>
              <Link href="/dashboard/customer">
                <Button>Return to My Orders</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const paymentConfig = PAYMENT_STATUS_CONFIG[order.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG] || PAYMENT_STATUS_CONFIG.PENDING
  const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG] || ORDER_STATUS_CONFIG.PENDING

  const orderDate = new Date(order.createdAt)
  const formattedDate = orderDate.toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const canRequestRefund = order.vendorAccepted && (order.status === 'DELIVERED' || order.status === 'COMPLETED')
  const isRejected = order.vendorRejected && order.status === 'CANCELLED'

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/dashboard/customer" 
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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6">
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
            <div className="flex flex-wrap gap-3 mb-6">
              <div>
                <span className="text-xs text-gray-500 mr-2">Payment:</span>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${paymentConfig.color}`}>
                  {paymentConfig.label}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 mr-2">Order:</span>
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                  {order.orderType === 'PREORDER' ? 'Pre-Order' : order.orderType === 'BACKORDER' ? 'Back-Order' : 'Normal'}
                </span>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 mr-2">Vendor Status:</span>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  VENDOR_ACCEPTANCE_CONFIG[order.vendorAccepted ? 'ACCEPTED' : order.vendorRejected ? 'REJECTED' : 'PENDING']?.color || 'bg-gray-100 text-gray-800'
                }`}>
                  {VENDOR_ACCEPTANCE_CONFIG[order.vendorAccepted ? 'ACCEPTED' : order.vendorRejected ? 'REJECTED' : 'PENDING']?.label || 'Pending'}
                </span>
              </div>
              {order.vendorRejected && order.vendorRejectionReason && (
                <div className="w-full mt-2">
                  <p className="text-xs text-gray-500">Rejection Reason:</p>
                  <p className="text-sm text-red-700">{order.vendorRejectionReason}</p>
                </div>
              )}
              {(order.orderType === 'PREORDER' || order.orderType === 'BACKORDER') && (
                <div>
                  <span className="text-xs text-gray-500 mr-2">Fulfillment:</span>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${FULFILLMENT_STATUS_CONFIG[order.fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {FULFILLMENT_STATUS_CONFIG[order.fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_CONFIG]?.label || order.fulfillmentStatus}
                  </span>
                </div>
              )}
            </div>

            {/* Expected Date Banner for Pre-orders/Backorders */}
            {order.orderType === 'PREORDER' && order.items.some(item => item.expectedArrivalDate) && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <p className="font-medium text-amber-800">Expected Arrival Date</p>
                    <p className="text-sm text-amber-700">
                      {order.items.find(item => item.expectedArrivalDate)?.expectedArrivalDate && 
                        new Date(order.items.find(item => item.expectedArrivalDate)!.expectedArrivalDate!).toLocaleDateString('en-GH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {order.orderType === 'BACKORDER' && order.items.some(item => item.expectedRestockDate) && (
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <p className="font-medium text-orange-800">Expected Restock Date</p>
                    <p className="text-sm text-orange-700">
                      {order.items.find(item => item.expectedRestockDate)?.expectedRestockDate && 
                        new Date(order.items.find(item => item.expectedRestockDate)!.expectedRestockDate!).toLocaleDateString('en-GH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Order Progress Timeline */}
            {renderOrderProgress()}
            
            {/* Fulfillment Progress for Pre-orders/Backorders */}
            {renderFulfillmentProgress()}

            {/* Order Summary */}
            <div className="border-t pt-4 mt-4">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>{formatPrice(0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Fee</span>
                  <span>{formatPrice(0)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                <span className="text-2xl font-bold text-gray-900">{formatPrice(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Order Items</h2>
          </CardHeader>
          <CardContent>
            {order.items.length === 0 ? (
              <p className="text-gray-600">No items in this order.</p>
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

        {/* Delivery Information */}
        {(order.user.profile?.address || order.user.profile?.phone) && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Delivery Information</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(order.user.profile?.firstName || order.user.profile?.lastName) ? (
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="text-gray-900">
                      {[order.user.profile?.firstName, order.user.profile?.lastName].filter(Boolean).join(' ')}
                    </p>
                  </div>
                ) : null}
                {order.user.profile?.phone ? (
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-900">{order.user.profile.phone}</p>
                  </div>
                ) : null}
                {order.user.profile?.address ? (
                  <div>
                    <p className="text-sm text-gray-500">Delivery Address</p>
                    <p className="text-gray-900">{order.user.profile.address}</p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Details */}
        {order.payment && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Reference</span>
                  <span className="text-gray-900 font-medium">{order.payment.reference}</span>
                </div>
                {order.payment.paystackRef && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Paystack Reference</span>
                    <span className="text-gray-900 font-medium">{order.payment.paystackRef}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="text-gray-900 font-medium">{formatPrice(order.payment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Date</span>
                  <span className="text-gray-900">
                    {new Date(order.payment.createdAt).toLocaleDateString('en-GH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fulfillment Events Timeline */}
        {(order.orderType === 'PREORDER' || order.orderType === 'BACKORDER') && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Fulfillment Events</h2>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <p className="text-sm text-gray-500">Loading events...</p>
              ) : (
                <EventTimeline events={events} />
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact Vendor / Refund Request Section */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Contact Vendor</h2>
          </CardHeader>
          <CardContent>
            {renderMessages()}
            
            {/* Message Input */}
            <div className="mt-4 pt-4 border-t">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message to the vendor..."
                rows={3}
                disabled={sendingMessage}
              />
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={() => handleSendMessage('GENERAL')}
                  disabled={sendingMessage || !newMessage.trim()}
                  size="sm"
                >
                  {sendingMessage ? 'Sending...' : 'Send Message'}
                </Button>
                {(canRequestRefund || isRejected) && (
                  <Button
                    onClick={() => setShowRefundDialog(true)}
                    variant="outline"
                    size="sm"
                  >
                    Request Refund
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Refund Request Dialog */}
        {showRefundDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Refund</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please provide a reason for your refund request. The vendor will review your request.
                </p>
                <Textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Describe why you're requesting a refund (e.g., defective item, wrong item received, etc.)"
                  rows={4}
                />
                <div className="flex gap-3 justify-end mt-4">
                  <Button
                    onClick={() => setShowRefundDialog(false)}
                    variant="outline"
                    disabled={sendingMessage}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleRefundRequest}
                    disabled={sendingMessage || !refundReason.trim()}
                  >
                    {sendingMessage ? 'Sending...' : 'Send Request'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/dashboard/customer" className="flex-1">
              <Button variant="outline" className="w-full">
                View All Orders
              </Button>
            </Link>
            <Link href="/marketplace" className="flex-1">
              <Button className="w-full">
                Continue Shopping
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