'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { formatPrice } from '@/lib/currency'
import { Textarea } from '@/components/Textarea'
import NeedHelpButton from '@/components/NeedHelpButton'

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
  orderType: string
  fulfillmentStatus: string
  vendorAccepted: boolean
  vendorRejected: boolean
  vendorRejectionReason?: string | null
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

// Order status configuration for vendor fulfillment workflow
const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'Pending', description: 'Awaiting processing', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  PROCESSING: { label: 'Processing', description: 'Preparing order', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  SHIPPED: { label: 'Shipped', description: 'In transit', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  DELIVERED: { label: 'Delivered', description: 'Out for delivery', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  COMPLETED: { label: 'Completed', description: 'Order complete', color: 'bg-green-100 text-green-800 border-green-300' },
  CANCELLED: { label: 'Cancelled', description: 'Order cancelled', color: 'bg-red-100 text-red-800 border-red-300' },
}

// Vendor acceptance status configuration
const VENDOR_ACCEPTANCE_CONFIG = {
  ACCEPTED: { label: 'Accepted', description: 'Order accepted by vendor', color: 'bg-green-100 text-green-800 border-green-300' },
  REJECTED: { label: 'Rejected', description: 'Order rejected by vendor', color: 'bg-red-100 text-red-800 border-red-300' },
  PENDING: { label: 'Pending Acceptance', description: 'Awaiting vendor acceptance', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
}

// Fulfillment status configuration
const FULFILLMENT_STATUS_CONFIG = {
  PENDING: { label: 'Pending', description: 'Ready to process', color: 'bg-gray-100 text-gray-800' },
  AWAITING_STOCK: { label: 'Awaiting Stock', description: 'Waiting for stock arrival', color: 'bg-amber-100 text-amber-800' },
  AWAITING_RESTOCK: { label: 'Awaiting Restock', description: 'Waiting for restock', color: 'bg-orange-100 text-orange-800' },
  READY_TO_FULFILL: { label: 'Ready to Fulfill', description: 'Stock confirmed, ready to process', color: 'bg-cyan-100 text-cyan-800' },
  PROCESSING: { label: 'Processing', description: 'Order being processed', color: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', description: 'Order shipped', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: 'Delivered', description: 'Order delivered', color: 'bg-indigo-100 text-indigo-800' },
  CANCELLED: { label: 'Cancelled', description: 'Order cancelled', color: 'bg-red-100 text-red-800' },
}

// Status progression for vendors (Order Status)
const STATUS_PROGRESSION = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED']

// Fulfillment status progression for pre-orders/backorders
const FULFILLMENT_PROGRESSION: Record<string, string[]> = {
  PREORDER: ['AWAITING_STOCK', 'READY_TO_FULFILL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'],
  BACKORDER: ['AWAITING_RESTOCK', 'READY_TO_FULFILL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED'],
}

export default function VendorOrderDetailPage() {
  const params = useParams()
  const orderId = params!.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [messages, setMessages] = useState<OrderMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [acceptanceAction, setAcceptanceAction] = useState<'accept' | 'reject' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionDialog, setShowRejectionDialog] = useState(false)
  const [vendorReply, setVendorReply] = useState('')
  const [respondingToRefund, setRespondingToRefund] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail()
      fetchMessages()
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

  const handleAcceptanceAction = async (action: 'accept' | 'reject') => {
    if (!order) return

    setAcceptanceAction(action)
    if (action === 'reject') {
      setShowRejectionDialog(true)
      return
    }

    await submitAcceptanceAction(action, null)
  }

  const submitAcceptanceAction = async (action: 'accept' | 'reject', reason: string | null) => {
    if (!order) return

    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/vendor/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          rejectionReason: reason,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || `Failed to ${action} order`)
        return
      }

      const data = await response.json()
      setOrder((prev) => prev ? { 
        ...prev, 
        vendorAccepted: data.order.vendorAccepted,
        vendorRejected: data.order.vendorRejected,
        vendorRejectionReason: data.order.vendorRejectionReason,
        status: data.order.status || prev.status,
        fulfillmentStatus: data.order.fulfillmentStatus || prev.fulfillmentStatus,
        updatedAt: data.order.updatedAt 
      } : null)
      setShowRejectionDialog(false)
      setRejectionReason('')
    } catch (err) {
      console.error(`Error ${action} order:`, err)
      alert(`Failed to ${action} order`)
    } finally {
      setUpdatingStatus(false)
      setAcceptanceAction(null)
    }
  }

  const getVendorAcceptanceStatus = () => {
    if (!order) return 'PENDING'
    if (order.vendorAccepted) return 'ACCEPTED'
    if (order.vendorRejected) return 'REJECTED'
    return 'PENDING'
  }

  const handleSendReply = async (messageType: 'GENERAL' | 'REFUND_APPROVAL' | 'REFUND_REJECTION') => {
    if (!vendorReply.trim() || !respondingToRefund) return

    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: vendorReply,
          messageType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to send reply')
        return
      }

      const data = await response.json()
      setMessages(prev => [...prev, data.message])
      setVendorReply('')
      setRespondingToRefund(null)
    } catch (err) {
      console.error('Error sending reply:', err)
      alert('Failed to send reply')
    }
  }

// Render fulfillment status progression
   const renderFulfillmentProgress = () => {
    if (!order) return null

    const fulfillmentConfig = FULFILLMENT_STATUS_CONFIG[order.fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_CONFIG]
    const orderStatusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
    
    const isPreorderOrBackorder = order.orderType === 'PREORDER' || order.orderType === 'BACKORDER'
    
    if (isPreorderOrBackorder) {
      const progression = FULFILLMENT_PROGRESSION[order.orderType] || []
      const currentIndex = progression.indexOf(order.fulfillmentStatus)
      const isCancelled = order.fulfillmentStatus === 'CANCELLED'

      return (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Fulfillment Progress</h3>
          
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              order.orderType === 'PREORDER' ? 'bg-cyan-100 text-cyan-800' : 'bg-orange-100 text-orange-800'
            }`}>
              {order.orderType === 'PREORDER' ? 'Pre-Order' : 'Back-Order'}
            </span>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              fulfillmentConfig?.color || 'bg-gray-100 text-gray-800'
            }`}>
              {fulfillmentConfig?.label || order.fulfillmentStatus}
            </span>
          </div>
          
          {!isCancelled && (
            <div className="flex items-center justify-between mb-4">
              {progression.map((status, index) => {
                const config = FULFILLMENT_STATUS_CONFIG[status as keyof typeof FULFILLMENT_STATUS_CONFIG]
                const isActive = index <= currentIndex
                const isCurrent = status === order.fulfillmentStatus
                
                return (
                  <div key={status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                          isActive 
                            ? isCurrent
                              ? 'bg-orange-600 text-white ring-2 ring-orange-100'
                              : 'bg-orange-100 text-orange-700'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {index + 1}
                      </div>
                      <span className={`text-xs mt-1 font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                        {config?.label?.split(' ')[0] || status}
                      </span>
                    </div>
                    {index < progression.length - 1 && (
                      <div 
                        className={`flex-1 h-1 mx-1 rounded transition-all ${
                          index < currentIndex ? 'bg-orange-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {fulfillmentConfig && (
            <div className={`p-4 rounded-lg border-2 ${fulfillmentConfig.color}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{fulfillmentConfig.label}</p>
                  <p className="text-sm opacity-80">{fulfillmentConfig.description}</p>
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
          )}
        </div>
      )
    }

    // Normal order progression
    const currentIndex = STATUS_PROGRESSION.indexOf(order.status)
    const isCancelled = order.status === 'CANCELLED'

    return (
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Order Progress</h3>
        
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

        <div className={`p-4 rounded-lg border-2 ${orderStatusConfig?.color || 'bg-gray-100 text-gray-800'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{orderStatusConfig?.label || order.status}</p>
              <p className="text-sm opacity-80">{orderStatusConfig?.description}</p>
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

  const renderMessages = () => {
    if (loadingMessages) {
      return <p className="text-sm text-gray-500">Loading messages...</p>
    }

    const refundRequests = messages.filter(msg => msg.messageType === 'REFUND_REQUEST')

    return (
      <div className="space-y-4">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages from customer.</p>
        ) : (
          <>
            {refundRequests.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Refund Requests</h4>
                {refundRequests.map((msg) => (
                  <div key={msg.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                    <p className="text-xs font-medium text-yellow-800 mb-1">Customer Request:</p>
                    <p className="text-sm text-gray-900">{msg.message.replace('Refund Request: ', '')}</p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={() => setRespondingToRefund(msg.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRespondingToRefund(msg.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="max-h-48 overflow-y-auto space-y-2">
              {messages.filter(msg => msg.messageType === 'GENERAL').map((msg) => {
                const userName = msg.user.profile?.firstName 
                  ? `${msg.user.profile.firstName} ${msg.user.profile.lastName || ''}`.trim()
                  : msg.user.email.split('@')[0]
                
                return (
                  <div key={msg.id} className="p-2 bg-gray-50 rounded">
                    <p className="text-xs font-medium text-gray-700">{userName}</p>
                    <p className="text-sm text-gray-900">{msg.message}</p>
                  </div>
                )
              })}
            </div>
          </>
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
              <Button asChild>
                <Link href="/dashboard/vendor">Return to Dashboard</Link>
              </Button>
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
              <Button asChild>
                <Link href="/dashboard/vendor">Return to Dashboard</Link>
              </Button>
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
              <div>
                <span className="text-xs text-gray-500 mr-2">Vendor Status:</span>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  VENDOR_ACCEPTANCE_CONFIG[getVendorAcceptanceStatus() as keyof typeof VENDOR_ACCEPTANCE_CONFIG]?.color || 'bg-gray-100 text-gray-800'
                }`}>
                  {VENDOR_ACCEPTANCE_CONFIG[getVendorAcceptanceStatus() as keyof typeof VENDOR_ACCEPTANCE_CONFIG]?.label || 'Pending'}
                </span>
              </div>
            </div>

            {/* Vendor Acceptance/Rejection Actions */}
            {order.vendorAccepted || order.vendorRejected ? (
              <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                {order.vendorAccepted && (
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Order Accepted</span> - You have accepted this order. You can now proceed with processing.
                  </p>
                )}
                {order.vendorRejected && (
                  <div>
                    <p className="text-sm text-red-700 font-medium">Order Rejected</p>
                    {order.vendorRejectionReason && (
                      <p className="text-sm text-gray-600 mt-1">Reason: {order.vendorRejectionReason}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-800 mb-3 font-medium">This order requires your acceptance</p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAcceptanceAction('accept')}
                    disabled={updatingStatus}
                    className="flex-1 sm:flex-none"
                  >
                    {updatingStatus && acceptanceAction === 'accept' ? 'Accepting...' : 'Accept Order'}
                  </Button>
                  <Button
                    onClick={() => handleAcceptanceAction('reject')}
                    disabled={updatingStatus}
                    variant="outline"
                    className="flex-1 sm:flex-none border-red-300 text-red-700 hover:bg-red-50"
                  >
                    {updatingStatus && acceptanceAction === 'reject' ? 'Rejecting...' : 'Reject Order'}
                  </Button>
                </div>
              </div>
            )}

            {/* Rejection Dialog */}
            {showRejectionDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-md">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Order</h3>
                    <p className="text-sm text-gray-600 mb-4">Please provide a reason for rejecting this order. This will cancel the order.</p>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter rejection reason..."
                      rows={3}
                    />
                    <div className="flex gap-3 justify-end mt-4">
                      <Button
                        onClick={() => setShowRejectionDialog(false)}
                        variant="outline"
                        disabled={updatingStatus}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => submitAcceptanceAction('reject', rejectionReason)}
                        disabled={updatingStatus || !rejectionReason.trim()}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {updatingStatus ? 'Rejecting...' : 'Reject Order'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Fulfillment Progress */}
            {renderFulfillmentProgress()}

            {/* Vendor Total */}
            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.vendorTotal)}</span>
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
              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Your Items Total</span>
                  <span className="text-2xl font-bold text-gray-900">{formatPrice(order.vendorTotal)}</span>
                </div>
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

        {/* Messages Section */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Messages from Customer</h2>
          </CardHeader>
          <CardContent>
            {renderMessages()}
          </CardContent>
        </Card>

        {/* Refund Response Dialog */}
        {respondingToRefund && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Respond to Refund Request</h3>
<p className="text-sm text-gray-600 mb-4">
          Please provide a response to the customer&apos;s refund request.
        </p>
                <Textarea
                  value={vendorReply}
                  onChange={(e) => setVendorReply(e.target.value)}
                  placeholder="Provide your response (e.g., reason for approval/rejection, next steps, etc.)"
                  rows={4}
                />
                <div className="flex gap-3 justify-end mt-4">
                  <Button
                    onClick={() => setRespondingToRefund(null)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleSendReply('REFUND_REJECTION')}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Reject Refund
                  </Button>
                  <Button
                    onClick={() => handleSendReply('REFUND_APPROVAL')}
                  >
                    Approve Refund
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild variant="outline" className="flex-1 min-h-[44px]">
            <Link href="/dashboard/vendor">Back to Dashboard</Link>
          </Button>
          <Button asChild className="flex-1 min-h-[44px]">
            <Link href="/dashboard/vendor/products">Manage Products</Link>
          </Button>
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