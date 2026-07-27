'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { MdVerified } from 'react-icons/md'
import NeedHelpButton from '@/components/NeedHelpButton'
import { ErrorBoundary } from '@/components/ErrorBoundary'

interface OrderItem {
  id: string
  quantity: number
  price: number
  order: {
    id: string
    status: string
    createdAt: string
    user: {
      id: string
      email: string
    }
  }
  product: {
    id: string
    name: string
  }
}

interface VendorMetrics {
  productCount: number
  activeOrderCount: number
  revenue: number
  vendorEarnings: number
  averageRating: number
  totalReviews: number
  bestSellers: Array<{
    productId: string
    productName: string
    totalSold: number
  }>
  totalPaidOrders: number
  hasStore: boolean
  hasCategory: boolean
  grossRevenue: number
  totalPayouts: number
  outstandingBalance: number
  verificationStatus: string
  fulfillment?: {
    preorder: { total: number; byStatus: Array<{ status: string; count: number }> }
    backorder: { total: number; byStatus: Array<{ status: string; count: number }> }
  }
  lowStockProducts?: Array<{
    productId: string
    availableStock: number
    threshold: number
  }>
  demandAnalytics?: {
    mostRequested: Array<{ productId: string; productName: string; totalDemand: number }>
    lowStockProducts: Array<{ productId: string; productName: string; availableStock: number; threshold: number }>
    outOfStockProducts: Array<{ productId: string; productName: string; availableStock: number }>
    recommendedRestocks: Array<{ productId: string; productName: string; recommendedQuantity: number; daysUntilStockout: number | null }>
    demandRankings: Array<{ productId: string; productName: string; totalDemand: number; avgDailySales: number }>
  }
  services?: {
    total: number
    published: number
    draft: number
    available: number
    busy: number
  }
}

interface OnboardingStep {
  id: string
  title: string
  description: string
  completed: boolean
  action: string
  href: string
}

export default function VendorDashboard() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [metrics, setMetrics] = useState<VendorMetrics>({
    productCount: 0,
    activeOrderCount: 0,
    revenue: 0,
    vendorEarnings: 0,
    averageRating: 0,
    totalReviews: 0,
    bestSellers: [],
    totalPaidOrders: 0,
    hasStore: false,
    hasCategory: false,
    grossRevenue: 0,
    totalPayouts: 0,
    outstandingBalance: 0,
    verificationStatus: 'NOT_APPLIED',
    services: {
      total: 0,
      published: 0,
      draft: 0,
      available: 0,
      busy: 0,
    },
  })
  const [loading, setLoading] = useState(true)
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [restockOrders, setRestockOrders] = useState<Array<{
    id: string
    productId: string
    productName: string
    quantityOrdered: number
    quantityReceived: number
    status: string
    expectedArrivalDate: string | null
    isOverdue: boolean
    daysUntilArrival: number | null
  }>>([])
  const [showCreateRestock, setShowCreateRestock] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [quantityToOrder, setQuantityToOrder] = useState<number>(0)

  useEffect(() => {
    fetchVendorOrders()
    fetchMetrics()
    fetchRestockOrders()
  }, [])

  const fetchVendorOrders = async () => {
    try {
      const response = await fetch('/api/vendor/orders')
      if (response.ok) {
        const data = await response.json()
        if (data?.error) {
          console.warn('API returned error:', data.error)
          setOrderItems([])
          return
        }
        setOrderItems((data?.orders || []).map((order: any) => ({
          id: order.id,
          quantity: order.items?.[0]?.quantity || 0,
          price: order.items?.[0]?.price || 0,
          order: {
            id: order.id,
            status: order.status,
            createdAt: order.createdAt,
            user: {
              id: order.user?.id || '',
              email: order.user?.email || ''
            }
          },
          product: {
            id: order.items?.[0]?.product?.id || '',
            name: order.items?.[0]?.product?.name || ''
          }
        })))
      }
    } catch (error) {
      console.error('Error fetching vendor orders:', error)
    }
  }

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/vendor/metrics')
      if (response.ok) {
        const data = await response.json()
        setMetrics((prev) => ({
          ...prev,
          productCount: data?.productCount ?? prev.productCount ?? 0,
          activeOrderCount: data?.activeOrderCount ?? prev.activeOrderCount ?? 0,
          revenue: data?.revenue ?? prev.revenue ?? 0,
          vendorEarnings: data?.vendorEarnings ?? prev.vendorEarnings ?? 0,
          averageRating: data?.averageRating ?? prev.averageRating ?? 0,
          totalReviews: data?.totalReviews ?? prev.totalReviews ?? 0,
          bestSellers: Array.isArray(data?.bestSellers) ? data.bestSellers : (prev.bestSellers || []),
          totalPaidOrders: data?.totalPaidOrders ?? prev.totalPaidOrders ?? 0,
          hasStore: data?.hasStore ?? prev.hasStore ?? false,
          hasCategory: data?.hasCategory ?? prev.hasCategory ?? false,
          grossRevenue: data?.grossRevenue ?? prev.grossRevenue ?? 0,
          totalPayouts: data?.totalPayouts ?? prev.totalPayouts ?? 0,
          outstandingBalance: data?.outstandingBalance ?? prev.outstandingBalance ?? 0,
          verificationStatus: data?.verificationStatus ?? prev.verificationStatus ?? 'NOT_APPLIED',
          fulfillment: data?.fulfillment || { preorder: { total: 0, byStatus: [] }, backorder: { total: 0, byStatus: [] } },
          lowStockProducts: Array.isArray(data?.lowStockProducts) ? data.lowStockProducts : [],
          demandAnalytics: data?.demandAnalytics || null,
          services: data?.services || prev.services || { total: 0, published: 0, draft: 0, available: 0, busy: 0 },
        }))
      }
    } catch (error) {
      console.error('Error fetching vendor metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyForVerification = async () => {
    if (actionLoading) return

    try {
      setActionLoading(true)

      const paymentResponse = await fetch('/api/verification-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await paymentResponse.json()

      if (!paymentResponse.ok) {
        alert(data.error || 'Failed to start verification payment')
        return
      }

      window.location.href = data.authorizationUrl
    } catch (error) {
      console.error('Error applying for verification:', error)
      alert('Error applying for verification')
    } finally {
      setActionLoading(false)
    }
  }

  const renderVerificationStatusBadge = () => {
    const status = metrics.verificationStatus
    const variants: Record<string, 'info' | 'default' | 'success' | 'danger' | 'warning'> = {
      APPROVED: 'success',
      PENDING_REVIEW: 'info',
      REJECTED: 'danger',
      CHANGES_REQUESTED: 'warning',
      PAID_PENDING_KYC: 'info',
      UNPAID: 'default'
    }
    return (
      <Badge variant={variants[status] || 'default'} size="sm" className="flex items-center gap-1">
        {status === 'APPROVED' && <MdVerified className="w-3 h-3" />}
        {status.replace(/_/g, ' ')}
      </Badge>
    )
  }

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingOrders(prev => new Set(prev).add(orderId))
    try {
      const response = await fetch(`/api/vendor/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        await fetchVendorOrders()
        await fetchMetrics()
      } else {
        const error = await response.json()
        console.error('API error response:', error)
        alert(error.error || error.details || 'Failed to update order status')
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Error updating order status')
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  const fetchRestockOrders = async () => {
    try {
      const response = await fetch('/api/vendor/restock-orders')
      if (response.ok) {
        const data = await response.json()
        setRestockOrders(data.restockOrders || [])
      }
    } catch (error) {
      console.error('Error fetching restock orders:', error)
    }
  }

  const createRestockOrderHandler = async () => {
    if (!selectedProduct || quantityToOrder <= 0) return

    try {
      const response = await fetch('/api/vendor/restock-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct,
          quantityOrdered: quantityToOrder,
        }),
      })

      if (response.ok) {
        setShowCreateRestock(false)
        setSelectedProduct('')
        setQuantityToOrder(0)
        fetchRestockOrders()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create restock order')
      }
    } catch (error) {
      console.error('Error creating restock order:', error)
      alert('Failed to create restock order')
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-lg ${
              star <= Math.round(rating) ? 'text-yellow-400' : 'text-slate-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
    )
  }

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'store',
      title: 'Store Profile',
      description: 'Set up your store information to build trust with customers',
      completed: metrics.hasCategory,
      action: metrics.hasCategory ? 'View Store' : 'Set Up',
      href: '/dashboard/vendor/store'
    },
    {
      id: 'products',
      title: 'Add Products',
      description: 'List your products to start selling on the marketplace',
      completed: metrics.productCount > 0,
      action: metrics.productCount > 0 ? 'Manage Products' : 'Add Product',
      href: '/dashboard/vendor/products'
    },
    {
      id: 'orders',
      title: 'First Sale',
      description: 'Complete your first order to unlock vendor features',
      completed: metrics.totalPaidOrders > 0,
      action: metrics.totalPaidOrders > 0 ? 'View Orders' : 'Wait for Orders',
      href: '/dashboard/vendor/orders'
    },
    {
      id: 'reviews',
      title: 'Customer Reviews',
      description: 'Build trust by earning positive reviews from customers',
      completed: metrics.totalReviews > 0,
      action: metrics.totalReviews > 0 ? 'View Reviews' : 'Await Reviews',
      href: '/dashboard/vendor/orders'
    }
  ]

  const completedSteps = onboardingSteps.filter(step => step.completed).length
  const isFullyOnboarded = completedSteps === onboardingSteps.length

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Seller Command Center
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Your Store Dashboard
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Manage your products, track orders, and grow your business with powerful seller tools.
</p>
           </div>
        </div>
      </div>
 
      {/* Onboarding Banner */}
      {onboardingSteps.length > 0 && !onboardingSteps[0].completed && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-amber-50 to-orange-100 border-l-4 border-amber-500 p-6 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 9l-.732-2.28A2 2 0 0115.567 7H18a2 2 0 012 2v5a2 2 0 01-2 2h-5l-1 1-1-1H9a2 2 0 01-2-2V7a2 2 0 012-2h2.432l1.132 2.707c.77 1.333-.192 2.541-1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Complete your store setup to start selling
                </p>
                <Link
                  href="/dashboard/vendor/store"
                  className="mt-1 inline-flex items-center px-3 py-1 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700"
                >
                  Complete Setup
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open Restock Orders Section */}
      {!loading && restockOrders.length > 0 && (
        <div className="mb-8">
          <Card variant="elevated" className="border-2 border-blue-200">
            <CardContent className="p-6">
<div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-semibold text-deep-navy">Open Restock Orders</h3>
             <Button asChild variant="outline" size="sm">
               <Link href="/dashboard/vendor/restock">View All</Link>
             </Button>
           </div>
              <p className="text-sm text-slate-600 mb-4">
                Track your incoming inventory from active restock orders.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {restockOrders.filter(o => o.status !== 'RECEIVED' && o.status !== 'CANCELLED').slice(0, 4).map((order) => (
                  <div key={order.id} className={`flex items-center justify-between p-3 rounded-lg border ${order.isOverdue ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div>
                      <p className="font-medium text-deep-navy">{order.productName}</p>
                      <p className="text-sm text-slate-600">
                        {order.quantityOrdered} units • Status: <span className="font-semibold">{order.status.replace(/_/g, ' ')}</span>
                      </p>
                      {order.expectedArrivalDate && (
                        <p className={`text-xs mt-1 ${order.isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                          Expected: {order.expectedArrivalDate}
                        </p>
                      )}
                    </div>
                    <Badge variant={order.isOverdue ? 'danger' : 'info'} size="sm">
                      {order.isOverdue ? 'Overdue' : order.daysUntilArrival !== null ? `${order.daysUntilArrival}d left` : 'Pending'}
                    </Badge>
                  </div>
                ))}
              </div>
{restockOrders.filter(o => o.status !== 'RECEIVED' && o.status !== 'CANCELLED').length > 4 && (
                 <div className="text-center mt-4">
                   <Button asChild variant="outline" size="sm">
                     <Link href="/dashboard/vendor/restock">View All {restockOrders.filter(o => o.status !== 'RECEIVED' && o.status !== 'CANCELLED').length} Open Orders</Link>
                   </Button>
                 </div>
               )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Orders */}
      <Card variant="elevated" className="mb-8">
        <CardContent className="p-6">
<div className="flex items-center justify-between mb-6">
             <h3 className="text-lg font-semibold text-deep-navy">Recent Orders</h3>
             <Button asChild variant="ghost" size="sm">
               <Link href="/dashboard/vendor/orders">View All Orders</Link>
             </Button>
           </div>

           {loading ? (
             <div className="space-y-4">
               <SkeletonCard />
               <SkeletonCard />
             </div>
           ) : orderItems.length === 0 ? (
             <EmptyState
               icon={
                 <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                 </svg>
               }
               title="No orders yet"
               description="Your orders will appear here once customers start purchasing your products."
             />
           ) : (
             <div className="space-y-4">
               {orderItems.slice(0, 10).map((item) => (
                 <Link
                   key={item.id}
                   href={`/dashboard/vendor/orders/${item.order.id}`}
                   className="block border border-slate-200 rounded-xl p-4 hover:border-royal-blue hover:shadow-md transition-all"
                 >
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <div className="flex-1">
                       <div className="flex items-center gap-3 mb-2">
                         <span className="font-semibold text-deep-navy">{item.product.name}</span>
                         <Badge variant="default" size="sm">
                           Qty: {item.quantity}
                         </Badge>
                       </div>
                       <p className="text-sm text-slate-500">
                         Order #{item.order.id.slice(-8)} • {new Date(item.order.createdAt).toLocaleDateString('en-US', {
                           year: 'numeric',
                           month: 'short',
                           day: 'numeric',
                         })}
                       </p>
                       <p className="text-sm text-slate-500 mt-1">Customer: {item.order.user.email}</p>
                     </div>
                     <div className="text-right flex-shrink-0">
                       <p className="text-xl font-bold text-royal-blue">{formatPrice(item.price * item.quantity)}</p>
                       <Badge
                         variant={
                           item.order.status === 'PENDING'
                             ? 'warning'
                             : item.order.status === 'PROCESSING'
                             ? 'info'
                             : item.order.status === 'SHIPPED'
                             ? 'default'
                             : item.order.status === 'DELIVERED' || item.order.status === 'COMPLETED'
                             ? 'success'
                             : 'default'
                         }
                         size="sm"
                       >
                         {item.order.status}
                       </Badge>
                     </div>
                   </div>
                 </Link>
               ))}
{orderItems.length > 10 && (
                  <div className="text-center pt-4">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/dashboard/vendor/orders">View All {orderItems.length} Orders</Link>
                    </Button>
                  </div>
                )}
             </div>
           )}
         </CardContent>
       </Card>

{metrics.verificationStatus !== 'APPROVED' && (
          <Card variant="elevated" className="mb-8 border-2 border-royal-blue/20">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-deep-navy mb-1">Get Verified</h3>
                <p className="text-sm text-slate-600">
                  Apply for vendor verification to gain customer trust and access premium features.
                </p>
              </div>
<div className="flex gap-2">
                {metrics.verificationStatus !== 'NOT_APPLIED' && (
                  <Button asChild variant="outline" className="flex items-center gap-2 min-h-[44px]">
                    <Link href="/dashboard/vendor/verification">View Application</Link>
                  </Button>
                )}
                <Button
                  onClick={handleApplyForVerification}
                  disabled={actionLoading}
                  className="flex items-center gap-2 min-h-[44px]"
                >
                  <MdVerified className="w-5 h-5" />
                  {actionLoading ? 'Processing...' : metrics.verificationStatus === 'NOT_APPLIED' ? 'Apply For Verification' : 'Restart Application'}
                </Button>
              </div>
           </CardContent>
         </Card>
       )}

      {/* Quick Actions */}
      <Card variant="elevated">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Actions</h3>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group min-h-[44px]">
                <Link href="/dashboard/vendor/products/new">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Add Product</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group min-h-[44px]">
                <Link href="/dashboard/vendor/products">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Manage Products</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group min-h-[44px]">
                <Link href="/dashboard/vendor/services">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 21c-2.767 0-5.387-.631-7.727-1.707M9 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Manage Services</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group min-h-[44px]">
                <Link href="/dashboard/vendor/orders">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">View Orders</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group min-h-[44px]">
                <Link href="/dashboard/vendor/store">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572-1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Store Settings</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group min-h-[44px]">
                <Link href="/dashboard/vendor/settings">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Account Settings</span>
                </Link>
              </Button>
              <div>
                <NeedHelpButton
                  variant="outline"
                  size="sm"
                  category="VENDOR"
                  fullWidth
                  className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {metrics.services && (
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-deep-navy">Service Analytics</h3>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/vendor/services">View All Services</Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-deep-navy">{metrics.services.total}</p>
                  <p className="text-xs text-slate-500 mt-1">Total Services</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{metrics.services.published}</p>
                  <p className="text-xs text-slate-500 mt-1">Published</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-amber-700">{metrics.services.draft}</p>
                  <p className="text-xs text-slate-500 mt-1">Draft</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{metrics.services.available}</p>
                  <p className="text-xs text-slate-500 mt-1">Available</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-purple-700">{metrics.services.busy}</p>
                  <p className="text-xs text-slate-500 mt-1">Busy</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ErrorBoundary>
  )
}
