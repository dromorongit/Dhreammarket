'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import NeedHelpButton from '@/components/NeedHelpButton'

interface OrderItem {
  id: string
  quantity: number
  price: number
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
  createdAt: string
  updatedAt: string
  customerFirstName: string | null
  customerLastName: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerRegion: string | null
  shippingZone: string | null
  shippingDaysMin: number | null
  shippingDaysMax: number | null
  items: OrderItem[]
  payment: Payment | null
}

const ORDER_STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-700' },
  SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-indigo-100 text-indigo-700' },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700' },
}

const PAYMENT_STATUS_CONFIG = {
  PENDING: { label: 'Pending Payment', color: 'bg-amber-100 text-amber-700' },
  PAID: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700' },
  FAILED: { label: 'Failed', color: 'bg-rose-100 text-rose-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-rose-100 text-rose-700' },
  REFUNDED: { label: 'Refunded', color: 'bg-slate-100 text-slate-700' },
}

export default function CustomerOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getOrderStatusConfig = (status: string) => {
    return ORDER_STATUS_CONFIG[status as keyof typeof ORDER_STATUS_CONFIG] || ORDER_STATUS_CONFIG.PENDING
  }

  const getPaymentStatusConfig = (status: string) => {
    return PAYMENT_STATUS_CONFIG[status as keyof typeof PAYMENT_STATUS_CONFIG] || PAYMENT_STATUS_CONFIG.PENDING
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="premium">Order History</Badge>
            <div className="flex-1 h-px bg-gradient-to-r from-royal-blue/20 to-transparent"></div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">
            My Orders
          </h1>
          <p className="text-slate-600 mt-2">
            Track and manage all your orders in one place
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Orders</p>
                <p className="text-xl font-bold text-deep-navy">{orders.length}</p>
              </div>
            </div>
          </Card>
          
          <Card variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Spent</p>
                <p className="text-xl font-bold text-deep-navy">
                  {formatPrice(orders.reduce((sum, o) => sum + o.total, 0))}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending Orders</p>
                <p className="text-xl font-bold text-deep-navy">
                  {orders.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            title="No orders yet"
            description="You haven't placed any orders yet. Start shopping to see your order history."
            actionLabel="Browse Marketplace"
            onAction={() => router.push('/marketplace')}
          />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderStatus = getOrderStatusConfig(order.status)
              const paymentStatus = getPaymentStatusConfig(order.paymentStatus)
              
              return (
                <Link
                  key={order.id}
                  href={`/dashboard/customer/orders/${order.id}`}
                  className="block border border-slate-200 rounded-2xl p-6 hover:border-royal-blue hover:shadow-md transition-all bg-white"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-deep-navy text-lg">
                          Order #{order.id.slice(-8).toUpperCase()}
                        </span>
                        <Badge variant="default" size="sm" className={orderStatus.color}>
                          {orderStatus.label}
                        </Badge>
                        <Badge 
                          variant={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'PENDING' ? 'warning' : 'danger'} 
                          size="sm"
                          className={paymentStatus.color}
                        >
                          {paymentStatus.label}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-slate-500 space-y-1">
                        <p>
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p>
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}: {' '}
                          {order.items.map(item => item.product.name).join(', ')}
                        </p>
                        {order.shippingZone && (
                          <p className="text-slate-400">
                            Shipping: {order.shippingZone} ({order.shippingDaysMin}-{order.shippingDaysMax} days)
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-bold text-royal-blue">
                        {formatPrice(order.total)}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {order.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Support Section */}
        <div className="mt-12">
          <Card variant="elevated">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-deep-navy mb-4">Need Help with an Order?</h3>
              <p className="text-slate-600 mb-4">
                If you have any questions about your orders, our support team is here to help.
              </p>
              <NeedHelpButton
                variant="outline"
                size="sm"
                category="ORDER"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}