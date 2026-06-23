'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import NeedHelpButton from '@/components/NeedHelpButton'

interface Order {
  id: string
  total: number
  status: string
  paymentStatus: string
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    price: number
    product: {
      id: string
      name: string
    }
  }>
}

export default function CustomerDashboard() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders)
        if (data.orders.length > 0) {
          setShowOnboarding(false)
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-100 text-emerald-700'
      case 'PENDING':
        return 'bg-amber-100 text-amber-700'
      case 'FAILED':
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-700'
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-700'
      case 'SHIPPED':
        return 'bg-purple-100 text-purple-700'
      case 'DELIVERED':
        return 'bg-indigo-100 text-indigo-700'
      case 'COMPLETED':
        return 'bg-emerald-100 text-emerald-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy to-royal-blue py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Customer Dashboard
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Welcome Back
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Your personal command center for managing orders, tracking purchases, and exploring new products.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        {/* Onboarding Guidance */}
        {showOnboarding && (
          <div className="mb-8 animate-fade-in-up">
            <Card variant="elevated">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-deep-navy mb-2">Getting Started</h2>
                    <p className="text-slate-600 mb-4">
                      Here are a few simple steps to help you make the most of Dhream Market:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-royal-blue/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-royal-blue font-bold text-sm">1</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-deep-navy text-sm">Explore Marketplace</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            Browse products from verified vendors across categories.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-royal-blue/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-royal-blue font-bold text-sm">2</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-deep-navy text-sm">Add to Cart</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            Select products and add them for easy checkout.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-royal-blue/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-royal-blue font-bold text-sm">3</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-deep-navy text-sm">Secure Checkout</h3>
                          <p className="text-sm text-slate-500 mt-1">
                            Complete purchases with secure payment processing.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-6">
                      <Button asChild size="sm">
                <Link href="/marketplace">
                  Browse Marketplace
                </Link>
              </Button>
                      <Button asChild variant="outline" size="sm">
                <Link href="/cart">
                  View Cart
                </Link>
              </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Orders</p>
                  <p className="text-2xl font-bold text-deep-navy">{orders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Spent</p>
                  <p className="text-2xl font-bold text-deep-navy">
                    {formatPrice(orders.reduce((sum, o) => sum + o.total, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Completed Orders</p>
                  <p className="text-2xl font-bold text-deep-navy">
                    {orders.filter(o => o.status === 'COMPLETED' || o.status === 'DELIVERED').length}
                  </p>
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
                  <p className="text-sm text-slate-500">Pending</p>
                  <p className="text-2xl font-bold text-deep-navy">
                    {orders.filter(o => o.status === 'PENDING' || o.status === 'PROCESSING').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card variant="elevated" className="lg:col-span-2">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                <Link href="/marketplace">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Marketplace</span>
                </Link>
              </Button>
<Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                <Link href="/cart">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 110 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Cart</span>
                </Link>
              </Button>
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                <Link href="/dashboard/customer/orders">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Orders</span>
                </Link>
              </Button>
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group">
                <Link href="/dashboard/customer/profile">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Profile</span>
                </Link>
              </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-deep-navy mb-4">Account Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Status</span>
                  <Badge variant="success" size="sm">Active</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Member Since</span>
                  <span className="text-sm font-medium text-deep-navy">
                    {new Date().toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">Total Orders</span>
                  <span className="text-sm font-medium text-deep-navy">{orders.length}</span>
                </div>
<Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/dashboard/customer/profile">
                  Update Profile
                </Link>
              </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-deep-navy">Recent Orders</h3>
              {orders.length > 0 && (
<Button asChild variant="ghost" size="sm">
                 <Link href="/dashboard/customer/orders">
                   View All Orders
                 </Link>
               </Button>
              )}
            </div>

            {loading ? (
              <div className="space-y-4">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                {orders.slice(0, 5).map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/customer/orders/${order.id}`}
                    className="block border border-slate-200 rounded-xl p-4 hover:border-royal-blue hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-deep-navy">Order #{order.id.slice(-8)}</span>
                          <div className="flex gap-2">
                            <Badge variant="default" size="sm">
                              {order.status}
                            </Badge>
                            <Badge variant={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'PENDING' ? 'warning' : 'danger'} size="sm">
                              {order.paymentStatus}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500">
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          {order.items.length} item{order.items.length !== 1 ? 's' : ''}: {order.items.map(item => item.product.name).join(', ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-royal-blue">{formatPrice(order.total)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
                {orders.length > 5 && (
                  <div className="text-center pt-4">
<Button asChild variant="outline" size="sm">
                   <Link href="/dashboard/customer/orders">
                     View All {orders.length} Orders
                   </Link>
                 </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Support Section */}
        <Card variant="elevated">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-deep-navy mb-4">Need Help?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <h4 className="font-medium text-deep-navy mb-2">Get Support</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Having issues with an order? Create a support ticket and we&apos;ll assist you.
                </p>
                <NeedHelpButton
                  variant="outline"
                  size="sm"
                  category="ORDER"
                  fullWidth
                />
              </div>
              <div className="p-4 bg-slate-50 rounded-xl">
                <h4 className="font-medium text-deep-navy mb-2">Browse FAQs</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Find instant answers to common questions about orders, payments, and more.
                </p>
<Button asChild variant="outline" size="sm" className="w-full">
                   <Link href="/faq">
                     View FAQs
                   </Link>
                 </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
