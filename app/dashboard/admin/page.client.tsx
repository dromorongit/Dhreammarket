'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'

interface PlatformStats {
  totalUsers: number
  totalVendors: number
  totalProducts: number
  totalOrders: number
  verifiedVendors: number
  totalGrossAmount: number
  totalProcessorFee: number
  totalNetAmount: number
  totalPlatformCommission: number
  totalVendorEarnings: number
  totalRevenue: number
  totalReviews: number
  totalCategories: number
  paidOrderCount: number
  pendingVerifications: number
  preorderAnalytics?: {
    total: number
    byStatus: Array<{ status: string; count: number }>
  }
  backorderAnalytics?: {
    total: number
    byStatus: Array<{ status: string; count: number }>
  }
  overdueOrders?: number
  avgFulfillmentDays?: number
}

interface DemandAnalytics {
  mostPreorderedProducts: Array<{ productId: string; productName: string; preorderCount: number }>
  mostBackorderedProducts: Array<{ productId: string; productName: string; backorderCount: number }>
  topDemandCategories: Array<{ categoryId: string; categoryName: string; demandCount: number }>
  topDemandVendors: Array<{ vendorId: string; vendorName: string; demandCount: number }>
  stockoutFrequency: Array<{ productId: string; productName: string; stockoutCount: number }>
}

interface SupportTicket {
  id: string
  subject: string
  status: string
  createdAt: string
  user: {
    email: string
  }
}

interface RecentItem {
  id: string
  createdAt: string
  email?: string
  role?: string
  status?: string
  total?: number
  name?: string
  isVerified?: boolean
}

interface AdminDashboardProps {
  stats: PlatformStats | null
  recentOrders: Array<{
    id: string
    createdAt: string
    user: {
      email: string
      role: string
    }
    total: number
  }>
  recentUsers: Array<{
    id: string
    email: string
    role: string
    createdAt: string
  }>
  recentVendors: Array<{
    id: string
    email: string
    role: string
    createdAt: string
    store: {
      name: string
    } | null
  }>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [demandAnalytics, setDemandAnalytics] = useState<DemandAnalytics | null>(null)
  const [recentOrders, setRecentOrders] = useState<Array<{
    id: string
    createdAt: string
    user: {
      email: string
      role: string
    }
    total: number
  }>>([])
  const [recentUsers, setRecentUsers] = useState<Array<{
    id: string
    email: string
    role: string
    createdAt: string
  }>>([])
  const [recentVendors, setRecentVendors] = useState<Array<{
    id: string
    createdAt: string
    email: string
    role: string
    store: {
      name: string
    } | null
  }>>([])
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      const [statsRes, supportRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/support'),
      ])

      if (!statsRes.ok || !supportRes.ok) {
        setError('Failed to load dashboard data')
        return
      }

      const statsData = await statsRes.json()
      const supportData = await supportRes.json()

      setStats(statsData.stats)
      setDemandAnalytics(statsData.demandAnalytics || null)
      setRecentOrders(statsData.recentOrders)
      setRecentUsers(statsData.recentUsers)
      setRecentVendors(statsData.recentVendors)
      setSupportTickets(supportData.tickets || [])
    } catch (err) {
      setError('Failed to fetch stats')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-fade-in-up">
            <div className="h-10 bg-slate-200 rounded-lg w-64 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <SkeletonCard />
          </div>
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
            title="Error Loading Dashboard"
            description={error}
          >
            <Button onClick={fetchStats} variant="primary">
              Try Again
            </Button>
          </EmptyState>
        </div>
      </div>
    )
  }

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
              Platform Operations Console
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Monitor platform health, manage users, and oversee marketplace operations with precision.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Users</p>
                  <p className="text-2xl font-bold text-deep-navy">{stats?.totalUsers.toLocaleString() || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Active Vendors</p>
                  <p className="text-2xl font-bold text-deep-navy">{stats?.totalVendors.toLocaleString() || 0}</p>
                  <p className="text-xs text-emerald-600 font-medium">
                    {stats?.verifiedVendors.toLocaleString() || 0} verified
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Products</p>
                  <p className="text-2xl font-bold text-deep-navy">{stats?.totalProducts.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-500">Listed items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Orders</p>
                  <p className="text-2xl font-bold text-deep-navy">{stats?.totalOrders.toLocaleString() || 0}</p>
                  <p className="text-xs text-slate-500">{stats?.paidOrderCount.toLocaleString() || 0} paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

         {/* Revenue Card */}
         <Card variant="elevated" className="mb-8 overflow-hidden relative">
           <div className="absolute inset-0 bg-gradient-to-br from-royal-blue/90 to-purple-900/90"></div>
           <CardContent className="p-8 relative">
             <div className="space-y-6">
               <div className="border-t border-slate-200 pt-6">
                 <h3 className="text-lg font-semibold text-white/90 mb-4">Financial Overview</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300">
                   <div>
                     <p className="text-sm font-medium">Gross Sales</p>
                     <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalGrossAmount || 0)}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium">Processor Fees</p>
                     <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalProcessorFee || 0)}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium">Platform Commission</p>
                     <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalPlatformCommission || 0)}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium">Vendor Earnings</p>
                     <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalVendorEarnings || 0)}</p>
                   </div>
                  </div>

                {/* Demand Analytics Section */}
               {!loading && demandAnalytics && (
                 <div className="mb-8">
                   <Card variant="elevated">
                     <CardContent className="p-6">
                       <h3 className="text-lg font-semibold text-deep-navy mb-4 flex items-center gap-2">
                         <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6m0 0V5m0 6h6m0 0v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2h2m2-2h6a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v10zM9 19v2m0 0v-2m0 0h6m0 0v2m0-2v-2" />
                         </svg>
                         Demand Analytics
                       </h3>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {/* Most Preordered Products */}
                         <div>
                           <h4 className="text-sm font-medium text-slate-600 mb-3">Most Preordered Products</h4>
                           {demandAnalytics.mostPreorderedProducts.length === 0 ? (
                             <p className="text-sm text-slate-500">No preorders yet</p>
                           ) : (
                             <div className="space-y-2">
                               {demandAnalytics.mostPreorderedProducts.slice(0, 5).map((p) => (
                                 <div key={p.productId} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                   <span className="text-sm text-deep-navy truncate max-w-[120px]">{p.productName}</span>
                                   <Badge variant="info" size="sm">{p.preorderCount} orders</Badge>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>

                         {/* Most Backordered Products */}
                         <div>
                           <h4 className="text-sm font-medium text-slate-600 mb-3">Most Backordered Products</h4>
                           {demandAnalytics.mostBackorderedProducts.length === 0 ? (
                             <p className="text-sm text-slate-500">No backorders yet</p>
                           ) : (
                             <div className="space-y-2">
                               {demandAnalytics.mostBackorderedProducts.slice(0, 5).map((p) => (
                                 <div key={p.productId} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                   <span className="text-sm text-deep-navy truncate max-w-[120px]">{p.productName}</span>
                                   <Badge variant="warning" size="sm">{p.backorderCount} orders</Badge>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>

                         {/* Top Demand Categories */}
                         <div>
                           <h4 className="text-sm font-medium text-slate-600 mb-3">Top Demand Categories</h4>
                           {demandAnalytics.topDemandCategories.length === 0 ? (
                             <p className="text-sm text-slate-500">No demand data</p>
                           ) : (
                             <div className="space-y-2">
                               {demandAnalytics.topDemandCategories.slice(0, 5).map((c) => (
                                 <div key={c.categoryId} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                   <span className="text-sm text-deep-navy truncate max-w-[120px]">{c.categoryName}</span>
                                   <Badge variant="success" size="sm">{c.demandCount} units</Badge>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>

                         {/* Top Demand Vendors */}
                         <div>
                           <h4 className="text-sm font-medium text-slate-600 mb-3">Top Demand Vendors</h4>
                           {demandAnalytics.topDemandVendors.length === 0 ? (
                             <p className="text-sm text-slate-500">No vendor demand data</p>
                           ) : (
                             <div className="space-y-2">
                               {demandAnalytics.topDemandVendors.slice(0, 5).map((v) => (
                                 <div key={v.vendorId} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                                   <span className="text-sm text-deep-navy truncate max-w-[120px]">{v.vendorName}</span>
                                   <Badge variant="default" size="sm">{v.demandCount} units</Badge>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>

                         {/* Stockout Frequency */}
                         <div>
                           <h4 className="text-sm font-medium text-slate-600 mb-3">Out of Stock Products</h4>
                           {demandAnalytics.stockoutFrequency.length === 0 ? (
                             <p className="text-sm text-slate-500">All products in stock</p>
                           ) : (
                             <div className="space-y-2">
                               {demandAnalytics.stockoutFrequency.slice(0, 5).map((p) => (
                                 <div key={p.productId} className="flex justify-between items-center p-2 bg-rose-50 rounded">
                                   <span className="text-sm text-deep-navy truncate max-w-[120px]">{p.productName}</span>
                                   <Badge variant="danger" size="sm">Out of Stock</Badge>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                 </div>
               )}
               </div>
               <div className="flex justify-between items-center">
                 <div>
                   <h3 className="text-lg font-semibold text-white/90 mb-2">Total Platform Revenue</h3>
                   <p className="text-4xl sm:text-5xl font-bold text-white mb-2">
                     {formatCurrency(stats?.totalRevenue || 0)}
                   </p>
                   <p className="text-slate-300">
                     From {stats?.paidOrderCount.toLocaleString() || 0} paid orders
                   </p>
                 </div>
                 <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" disabled title="Coming soon">
                      Export Report
                    </Button>
                   <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={fetchStats}>
                     Refresh
                   </Button>
                 </div>
               </div>
             </div>
           </CardContent>
         </Card>

 {/* Quick Stats Row */}
           <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
             <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
               <CardContent className="p-6">
                 <p className="text-sm text-slate-500 mb-1">Categories</p>
                 <p className="text-3xl font-bold text-deep-navy">{stats?.totalCategories.toLocaleString() || 0}</p>
                 <p className="text-sm text-slate-500 mt-1">Product categories</p>
               </CardContent>
             </Card>

             <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
               <CardContent className="p-6">
                 <p className="text-sm text-slate-500 mb-1">Pre-orders</p>
                 <p className="text-3xl font-bold text-cyan-600">{stats?.preorderAnalytics?.total ?? 0}</p>
                 <p className="text-sm text-slate-500 mt-1">Total pre-orders</p>
               </CardContent>
             </Card>

             <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
               <CardContent className="p-6">
                 <p className="text-sm text-slate-500 mb-1">Backorders</p>
                 <p className="text-3xl font-bold text-orange-600">{stats?.backorderAnalytics?.total ?? 0}</p>
                 <p className="text-sm text-slate-500 mt-1">Total backorders</p>
               </CardContent>
             </Card>

             <Link href="/dashboard/admin/verification-applications">
               <Card variant="outline" className="hover:border-royal-blue/30 transition-colors cursor-pointer">
                 <CardContent className="p-6">
                   <div className="flex items-center justify-between mb-2">
                     <p className="text-sm text-slate-500">Pending Verifications</p>
                     {(stats?.pendingVerifications ?? 0) > 0 && (
                       <Badge variant="warning" size="sm">{stats?.pendingVerifications}</Badge>
                     )}
                   </div>
                   <p className="text-3xl font-bold text-deep-navy">{(stats?.pendingVerifications ?? 0).toLocaleString()}</p>
                   <p className="text-sm text-slate-500 mt-1">Awaiting review</p>
                 </CardContent>
               </Card>
             </Link>
             
             {(stats?.overdueOrders ?? 0) > 0 && (
               <Link href="/dashboard/admin/orders">
                 <Card variant="outline" className="hover:border-red-300 transition-colors cursor-pointer">
                   <CardContent className="p-6">
                     <div className="flex items-center justify-between mb-2">
                       <p className="text-sm text-slate-500">Overdue Orders</p>
                       <Badge variant="danger" size="sm">{stats?.overdueOrders}</Badge>
                     </div>
                     <p className="text-3xl font-bold text-red-600">{(stats?.overdueOrders ?? 0).toLocaleString()}</p>
                     <p className="text-sm text-slate-500 mt-1">Needs attention</p>
                   </CardContent>
                 </Card>
               </Link>
             )}
             
             <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
               <CardContent className="p-6">
                 <p className="text-sm text-slate-500 mb-1">Avg. Fulfillment</p>
                 <p className="text-3xl font-bold text-indigo-600">{stats?.avgFulfillmentDays ?? 0}d</p>
                 <p className="text-sm text-slate-500 mt-1">For pre/backorders</p>
               </CardContent>
             </Card>
            </div>

          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-deep-navy">Support & Moderation</h3>
                <Button asChild variant="primary" size="sm">
                  <Link href="/dashboard/admin/support">View All</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {supportTickets.length === 0 ? (
                  <EmptyState
                    icon={
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    }
                    title="No support tickets"
                    description="Support tickets will appear here."
                    className="py-6"
                  />
                ) : (
                  <div className="space-y-2">
                    {supportTickets.slice(0, 5).map((ticket) => (
                      <div key={ticket.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{ticket.subject}</p>
                          <p className="text-xs text-slate-500">{ticket.user?.email || 'No email'}</p>
                        </div>
                        <Badge variant={ticket.status === 'OPEN' ? 'warning' : 'success'}>
                          {ticket.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Links & Platform Status */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
           <Card variant="elevated">
             <CardContent className="p-6">
               <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Actions</h3>
               <div className="grid grid-cols-2 gap-4">
                  <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                 <Link href="/dashboard/admin/users">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">Manage Users</span>
                 </Link>
               </Button>
 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                 <Link href="/dashboard/admin/vendors">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">Manage Vendors</span>
                 </Link>
               </Button>
 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                 <Link href="/dashboard/admin/vendor-categories">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">Vendor Categories</span>
                 </Link>
               </Button>
 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                 <Link href="/dashboard/admin/create-admin">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">Create Admin</span>
                 </Link>
               </Button>
 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                 <Link href="/dashboard/admin/products">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">Manage Products</span>
                 </Link>
               </Button>
 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                 <Link href="/dashboard/admin/orders">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">View Orders</span>
                 </Link>
               </Button>
 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                 <Link href="/dashboard/admin/payouts">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6m5 4h6" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">Manage Payouts</span>
                 </Link>
               </Button>
                 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                   <Link href="/dashboard/admin/verification-applications">
                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                     </div>
                     <span className="text-sm font-medium text-slate-700">Verify Vendors</span>
                   </Link>
                 </Button>
                 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                   <Link href="/dashboard/admin/support">
                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-royal-blue to-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                       <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                       </svg>
                     </div>
                     <span className="text-sm font-medium text-slate-700">Support Tickets</span>
                   </Link>
                 </Button>
                 <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/admin/settings">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-700">Account Settings</span>
                  </Link>
                </Button>
                </div>
             </CardContent>
           </Card>

           <Card variant="elevated">
             <CardContent className="p-6">
               <h3 className="text-lg font-semibold text-deep-navy mb-4">Platform Status</h3>
               <div className="space-y-3">
                 <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></div>
                     <span className="text-slate-700 font-medium">Database</span>
                   </div>
                   <span className="text-emerald-700 text-sm font-semibold">Connected</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></div>
                     <span className="text-slate-700 font-medium">API Services</span>
                   </div>
                   <span className="text-emerald-700 text-sm font-semibold">Operational</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse"></div>
                     <span className="text-slate-700 font-medium">Payment Gateway</span>
                   </div>
                   <span className="text-emerald-700 text-sm font-semibold">Active</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl">
                   <div className="flex items-center">
                     <div className="w-2 h-2 bg-royal-blue rounded-full mr-3"></div>
                     <span className="text-slate-700 font-medium">Platform Version</span>
                   </div>
                     <span className="text-royal-blue text-sm font-semibold">Dhream Market v1.5</span>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>

         {/* Recent Activity */}
         <Card variant="elevated">
           <CardContent className="p-6">
             <h3 className="text-lg font-semibold text-deep-navy mb-4">Recent Activity</h3>
             
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* Recent Orders */}
               <div className="lg:col-span-2">
                 <h4 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wide">Recent Orders</h4>
                 {recentOrders.length === 0 ? (
                   <EmptyState
                     icon={
                       <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                       </svg>
                     }
                     title="No recent orders"
                     description="Orders will appear here as they are placed."
                     className="py-8"
                   />
                 ) : (
                   <div className="space-y-3">
                     {recentOrders.map((order) => (
                       <div key={order.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-royal-blue/10 to-purple-500/10 flex items-center justify-center">
                             <svg className="w-5 h-5 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                             </svg>
                           </div>
                           <div>
                             <p className="font-medium text-deep-navy">Order #{order.id.slice(-8)}</p>
                             <p className="text-sm text-slate-500">
                               {new Date(order.createdAt).toLocaleDateString('en-US', {
                                 year: 'numeric',
                                 month: 'short',
                                 day: 'numeric',
                                 hour: '2-digit',
                                 minute: '2-digit'
                               })}
                             </p>
                           </div>
                         </div>
                         <div className="text-right">
                           <p className="font-bold text-deep-navy">{formatCurrency(order.total)}</p>
                           <p className="text-xs text-slate-500">{order.user.email}</p>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>

               {/* Recent Users */}
               <div>
                 <h4 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wide">Recent Users</h4>
                 {recentUsers.length === 0 ? (
                   <EmptyState
                     icon={
                       <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                       </svg>
                     }
                     title="No recent users"
                     description="New users will appear here."
                     className="py-8"
                   />
                 ) : (
                   <div className="space-y-3">
                     {recentUsers.map((user) => (
                       <div key={user.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                         <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                           {user.email.charAt(0).toUpperCase()}
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium text-deep-navy truncate">{user.email}</p>
                           <p className="text-xs text-slate-500">
                             {user.role === 'ADMIN' ? 'Admin' : user.role === 'VENDOR' ? 'Vendor' : 'Customer'}
                           </p>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   )
}
