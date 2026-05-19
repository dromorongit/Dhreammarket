'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/Card'
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
    totalPaidOrders: 0
  })
  const [loading, setLoading] = useState(true)
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchVendorOrders()
    fetchMetrics()
  }, [])

  const fetchVendorOrders = async () => {
    try {
      const response = await fetch('/api/vendor/orders')
      if (response.ok) {
        const data = await response.json()
        setOrderItems(data.orderItems)
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
        setMetrics(data)
      }
    } catch (error) {
      console.error('Error fetching vendor metrics:', error)
    } finally {
      setLoading(false)
    }
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

  // Onboarding steps
  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'store',
      title: 'Store Profile',
      description: 'Set up your store information to build trust with customers',
      completed: metrics.productCount > 0,
      action: metrics.productCount > 0 ? 'View Store' : 'Set Up',
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
      {!onboardingSteps[0].completed && (
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
   
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        {/* Onboarding Progress */}
        {!isFullyOnboarded && (
          <div className="mb-8 animate-fade-in-up">
            <Card variant="elevated">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-deep-navy mb-2">Get Started on Dhream Market</h2>
                    <p className="text-slate-600 mb-4">
                      Complete these steps to maximize your store's potential and start selling.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {onboardingSteps.map((step) => (
                        <div
                          key={step.id}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            step.completed
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-amber-200 bg-amber-50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                              step.completed ? 'bg-emerald-600' : 'bg-amber-600'
                            }`}>
                              {step.completed ? (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <span className="text-white text-sm font-bold">{step.id === 'store' ? '1' : step.id === 'products' ? '2' : step.id === 'orders' ? '3' : '4'}</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className={`text-sm font-semibold ${
                                step.completed ? 'text-emerald-800' : 'text-amber-900'
                              }`}>{step.title}</h3>
                              <p className="text-xs text-slate-500 mt-1">{step.description}</p>
                              <Link
                                href={step.href}
                                className={`inline-block mt-2 text-xs font-medium ${
                                  step.completed ? 'text-emerald-700 hover:text-emerald-800' : 'text-amber-700 hover:text-amber-800'
                                }`}
                              >
                                {step.action} →
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-500"
                          style={{ width: `${(completedSteps / onboardingSteps.length) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-slate-600">
                        {completedSteps} of {onboardingSteps.length} steps
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isFullyOnboarded && (
          <div className="mb-8 animate-fade-in-up">
            <Card variant="elevated">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl font-bold text-deep-navy mb-2">Welcome to Your Store!</h2>
                    <p className="text-slate-600">
                      Your store is fully set up and ready to sell. You've completed all onboarding steps!
                    </p>
                  </div>
                  <Link href="/marketplace">
                    <Button variant="outline">
                      View Marketplace
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

         {/* Key Metrics */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
           <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
             <CardContent className="p-6">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                   <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                   </svg>
                 </div>
                 <div>
                   <p className="text-sm text-slate-500">Products Listed</p>
                   <p className="text-2xl font-bold text-deep-navy">{loading ? <Skeleton className="h-8 w-16" /> : metrics.productCount}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
             <CardContent className="p-6">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                   <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                   </svg>
                 </div>
                 <div>
                   <p className="text-sm text-slate-500">Active Orders</p>
                   <p className="text-2xl font-bold text-deep-navy">{loading ? <Skeleton className="h-8 w-16" /> : metrics.activeOrderCount}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
             <CardContent className="p-6">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                   <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                 </div>
                 <div>
                   <p className="text-sm text-slate-500">Total Revenue</p>
                   <p className="text-2xl font-bold text-deep-navy">{loading ? <Skeleton className="h-8 w-20" /> : formatPrice(metrics.revenue)}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
             <CardContent className="p-6">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                   <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                 </div>
                 <div>
                   <p className="text-sm text-slate-500">Vendor Earnings</p>
                   <p className="text-2xl font-bold text-deep-navy">{loading ? <Skeleton className="h-8 w-20" /> : formatPrice(metrics.vendorEarnings)}</p>
                 </div>
               </div>
             </CardContent>
           </Card>
 
           <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
             <CardContent className="p-6">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                   <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                 </div>
                 <div>
                   <p className="text-sm text-slate-500">Rating</p>
                   <div className="flex items-center gap-2">
                     <p className="text-2xl font-bold text-deep-navy">{loading ? <Skeleton className="h-8 w-12" /> : metrics.averageRating.toFixed(1)}</p>
                     {!loading && metrics.totalReviews > 0 && renderStars(metrics.averageRating)}
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>

        {/* Store Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Reviews Card */}
          <Card variant="elevated">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-deep-navy mb-4">Customer Reviews</h3>
              {loading ? (
                <SkeletonCard />
              ) : metrics.totalReviews === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  }
                  title="No reviews yet"
                  description="Reviews will appear here when customers rate your products."
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-deep-navy">{metrics.averageRating.toFixed(1)}</p>
                      <div className="flex gap-1 mt-1">{renderStars(metrics.averageRating)}</div>
                    </div>
                    <div className="border-l border-slate-200 pl-4">
                      <p className="text-2xl font-bold text-deep-navy">{metrics.totalReviews}</p>
                      <p className="text-sm text-slate-500">Total Reviews</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Best Sellers Card */}
          <Card variant="elevated">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-deep-navy mb-4">Best Sellers</h3>
              {loading ? (
                <SkeletonCard />
              ) : metrics.bestSellers.length === 0 ? (
                <EmptyState
                  icon={
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                  title="No sales yet"
                  description="Best-selling products will appear here once you start making sales."
                />
              ) : (
                <div className="space-y-3">
                  {metrics.bestSellers.map((seller, index) => (
                    <div key={seller.productId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {index + 1}
                        </span>
                        <span className="font-medium text-deep-navy truncate max-w-[150px]">{seller.productName}</span>
                      </div>
                      <span className="text-sm text-slate-600 font-medium">{seller.totalSold} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Total Paid Orders</p>
              <p className="text-2xl font-bold text-deep-navy">{loading ? <Skeleton className="h-8 w-16" /> : metrics.totalPaidOrders}</p>
            </CardContent>
          </Card>
          <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">{loading ? <Skeleton className="h-8 w-20" /> : formatPrice(metrics.revenue)}</p>
            </CardContent>
          </Card>
          <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-1">Average Rating</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-deep-navy">{loading ? <Skeleton className="h-8 w-12" /> : metrics.averageRating.toFixed(1)}</p>
                {!loading && metrics.totalReviews > 0 && renderStars(metrics.averageRating)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-deep-navy">Recent Orders</h3>
              <Link href="/dashboard/vendor/orders">
                <Button variant="ghost" size="sm">
                  View All Orders
                </Button>
              </Link>
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
                    <Link href="/dashboard/vendor/orders">
                      <Button variant="outline" size="sm">
                        View All {orderItems.length} Orders
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card variant="elevated">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/dashboard/vendor/products/new">
                <Button variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Add Product</span>
                </Button>
              </Link>
              <Link href="/dashboard/vendor/products">
                <Button variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Manage Products</span>
                </Button>
              </Link>
              <Link href="/dashboard/vendor/orders">
                <Button variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">View Orders</span>
                </Button>
              </Link>
              <Link href="/dashboard/vendor/store">
                <Button variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Store Settings</span>
                </Button>
              </Link>
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
      </div>
    </div>
  )
}
