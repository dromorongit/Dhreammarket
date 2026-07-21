'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'

interface OrderItem {
  id: string
  quantity: number
  price: number
  color?: string | null
  size?: string | null
  age?: string | null
  productName: string
  productImage?: string | null
}

interface StoreGroup {
  storeName: string
  vendorContact: string | null
  items: OrderItem[]
}

interface Payment {
  id: string
  amount: number
  status: string
  reference: string
  paystackRef?: string | null
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
  customerName: string
  customerEmail: string
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerRegion: string | null
  storeGroups: StoreGroup[]
  payment?: {
    id: string
    amount: number
    status: string
    reference: string
    paystackRef?: string | null
    createdAt: string
  } | null
}

const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: 'Delivered', color: 'bg-indigo-100 text-indigo-800' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
}

const VENDOR_ACCEPTANCE_CONFIG = {
  ACCEPTED: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  PENDING: { label: 'Pending Acceptance', color: 'bg-yellow-100 text-yellow-800' },
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

const PAYMENT_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: 'Paid', color: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
  REFUNDED: { label: 'Refunded', color: 'bg-purple-100 text-purple-800' },
}

const DELIVERY_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  IN_TRANSIT: { label: 'In Transit', color: 'bg-blue-100 text-blue-800' },
  DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-800' },
}

export default function AdminOrderDetailPage() {
  const params = useParams()
  const orderId = params!.id as string
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail()
    }
  }, [orderId])

  const fetchOrderDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/admin/orders/${orderId}`)
      
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

  const getDeliveryStatus = (orderStatus: string) => {
    switch (orderStatus) {
      case 'PENDING':
      case 'PROCESSING':
        return 'PENDING'
      case 'SHIPPED':
        return 'IN_TRANSIT'
      case 'DELIVERED':
      case 'COMPLETED':
        return 'DELIVERED'
      default:
        return null
    }
  }

  const renderVariantInfo = (item: OrderItem) => {
    const parts = []
    if (item.color) parts.push(`Color: ${item.color}`)
    if (item.size) parts.push(`Size: ${item.size}`)
    if (item.age) parts.push(`Age: ${item.age}`)
    return parts.length > 0 ? ` (${parts.join(', ')})` : ''
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.694-1.333 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Order</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href="/dashboard/admin/orders">
                <Button>Back to Orders</Button>
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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Order Not Found</h2>
              <p className="text-gray-600 mb-6">The order you&apos;re looking for doesn&apos;t exist.</p>
              <Link href="/dashboard/admin/orders">
                <Button>Back to Orders</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const orderStatusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG] || ORDER_STATUS_CONFIG.PENDING
  const paymentStatusConfig = PAYMENT_STATUS_CONFIG[order.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG] || PAYMENT_STATUS_CONFIG.PENDING
  const deliveryStatus = getDeliveryStatus(order.status)
  const deliveryStatusConfig = deliveryStatus ? DELIVERY_STATUS_CONFIG[deliveryStatus as keyof typeof DELIVERY_STATUS_CONFIG] : null

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/admin/orders" className="text-blue-600 hover:underline text-sm">
            ← Back to Orders
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Order Details</h1>

        {/* Order Information */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Order Information</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Order ID</p>
                <p className="text-sm font-mono text-gray-900">#{order.id.slice(0, 8)}...{order.id.slice(-8)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="text-sm text-gray-900">
                  {new Date(order.createdAt).toLocaleDateString('en-GH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${orderStatusConfig.color}`}>
                  {orderStatusConfig.label}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vendor Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  VENDOR_ACCEPTANCE_CONFIG[order.vendorAccepted ? 'ACCEPTED' : order.vendorRejected ? 'REJECTED' : 'PENDING']?.color || 'bg-gray-100 text-gray-800'
                }`}>
                  {VENDOR_ACCEPTANCE_CONFIG[order.vendorAccepted ? 'ACCEPTED' : order.vendorRejected ? 'REJECTED' : 'PENDING']?.label || 'Pending'}
                </span>
              </div>
              {order.vendorRejected && order.vendorRejectionReason && (
                <div className="sm:col-span-2">
                  <p className="text-sm text-gray-500">Rejection Reason</p>
                  <p className="text-sm text-red-700">{order.vendorRejectionReason}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Payment Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${paymentStatusConfig.color}`}>
                  {paymentStatusConfig.label}
                </span>
              </div>
              {order.orderType !== 'NORMAL' && (
                <div>
                  <p className="text-sm text-gray-500">Order Type</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    order.orderType === 'PREORDER' ? 'bg-cyan-100 text-cyan-800' : 'bg-orange-100 text-orange-800'
                  }`}>
                    {order.orderType === 'PREORDER' ? 'Pre-Order' : 'Back-Order'}
                  </span>
                </div>
              )}
              {order.orderType !== 'NORMAL' && (
                <div>
                  <p className="text-sm text-gray-500">Fulfillment Status</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${FULFILLMENT_STATUS_CONFIG[order.fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_CONFIG]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {FULFILLMENT_STATUS_CONFIG[order.fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_CONFIG]?.label?.split(' ')[0] || order.fulfillmentStatus}
                  </span>
                </div>
              )}
              {deliveryStatusConfig && (
                <div>
                  <p className="text-sm text-gray-500">Delivery Status</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${deliveryStatusConfig.color}`}>
                    {deliveryStatusConfig.label}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer Information */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Customer</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Customer Name</p>
                <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Customer Email</p>
                <p className="text-sm text-gray-900">{order.customerEmail}</p>
              </div>
              {order.customerPhone && (
                <div>
                  <p className="text-sm text-gray-500">Customer Phone</p>
                  <p className="text-sm text-gray-900">{order.customerPhone}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Information */}
        {(order.customerAddress || order.customerCity || order.customerRegion) && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Delivery Information</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.customerAddress && (
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="text-sm text-gray-900">{order.customerAddress}</p>
                  </div>
                )}
                {order.customerCity && (
                  <div>
                    <p className="text-sm text-gray-500">City</p>
                    <p className="text-sm text-gray-900">{order.customerCity}</p>
                  </div>
                )}
                {order.customerRegion && (
                  <div>
                    <p className="text-sm text-gray-500">Region</p>
                    <p className="text-sm text-gray-900">{order.customerRegion}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Store Information */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Store Information</h2>
          </CardHeader>
          <CardContent>
            {order.storeGroups.length === 0 ? (
              <p className="text-gray-600">No store information available.</p>
            ) : (
              <div className="space-y-4">
                {order.storeGroups.map((group, index) => (
                  <div key={index} className="border-b last:border-0 pb-4 last:pb-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-gray-500">Store Name</p>
                        <p className="text-sm font-medium text-gray-900">{group.storeName}</p>
                      </div>
                      {group.vendorContact && (
                        <div>
                          <p className="text-sm text-gray-500">Vendor Contact</p>
                          <p className="text-sm text-gray-900">{group.vendorContact}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products */}
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Products</h2>
          </CardHeader>
          <CardContent>
            {order.storeGroups.map((group) => (
              <div key={group.storeName} className="mb-6 last:mb-0">
                <h3 className="text-sm font-medium text-gray-700 mb-3">{group.storeName}</h3>
                <div className="space-y-3">
                  {group.items.map((item) => (
<div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      {item.productImage && (
                        <Image
                          src={item.productImage}
                          alt={item.productName}
                          width={80}
                          height={80}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{item.productName}{renderVariantInfo(item)}</p>
                        <p className="text-sm text-gray-600">
                          Quantity: {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Information */}
        {order.payment && (
          <Card className="mb-6">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(order.payment.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="text-sm text-gray-900">Paystack</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transaction Reference</p>
                  <p className="text-sm font-mono text-gray-900">{order.payment.reference}</p>
                </div>
                {order.payment.paystackRef && (
                  <div>
                    <p className="text-sm text-gray-500">Paystack Reference</p>
                    <p className="text-sm font-mono text-gray-900">{order.payment.paystackRef}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

{/* Order Total */}
         <Card className="mb-6">
           <CardContent className="p-6">
             <div className="space-y-2 mb-4">
               <div className="flex justify-between text-slate-600">
                 <span>Subtotal</span>
                 <span>{formatCurrency(order.total)}</span>
               </div>
               <div className="flex justify-between text-slate-600">
                 <span>Tax</span>
                 <span>{formatCurrency(0)}</span>
               </div>
               <div className="flex justify-between text-slate-600">
                 <span>Delivery Fee</span>
                 <span>{formatCurrency(0)}</span>
               </div>
             </div>
             <div className="border-t border-slate-200 pt-4">
               <div className="flex justify-between items-center">
                 <span className="text-lg font-semibold text-gray-900">Total Amount</span>
                 <span className="text-2xl font-bold text-gray-900">{formatCurrency(order.total)}</span>
               </div>
             </div>
           </CardContent>
         </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/dashboard/admin/orders" className="flex-1">
            <Button variant="outline" className="w-full min-h-[44px]">
              Back to Orders
            </Button>
          </Link>
          <Link href="/dashboard/admin" className="flex-1">
            <Button className="w-full min-h-[44px]">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}