'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, ReferenceLine
} from 'recharts'

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
}

interface AdminUser {
   id: string
   email: string
   role: string
   createdAt: string
   mobileNumber?: string | null
   profile?: {
     firstName?: string
     lastName?: string
     phone: string | null
   }
 }

interface Vendor {
   id: string
   storeName?: string | null
   name?: string | null
   email: string
   mobileNumber?: string | null
   createdAt: string
   store?: {
     name: string
     isVerified: boolean
     isFeatured: boolean
   } | null
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

 interface AnalyticsData {
   kpis: {
     totalRevenue: number
     todayRevenue: number
     weeklyRevenue: number
     monthlyRevenue: number
     yearlyRevenue: number
     totalOrders: number
     completedOrders: number
     pendingOrders: number
     cancelledOrders: number
     totalBookings: number
     completedBookings: number
     pendingBookings: number
     vendorGrowth: number
     customerGrowth: number
     activeUsers: number
     dailyActiveUsers: number
     monthlyActiveUsers: number
     conversionRate: number
     averageOrderValue: number
     repeatCustomerPercentage: number
     productsSold: number
     servicesBooked: number
   }
   rankings: {
     topCategories: Array<{ name: string; revenue: number }>
     topProducts: Array<{ name: string; salesCount: number }>
     topServices: Array<{ title: string; count: number }>
     topVendors: Array<{ name: string; orderCount: number }>
     topBrands: Array<{ name: string; revenue: number }>
     mostViewedProducts: Array<{ name: string; views: number }>
     mostViewedServices: Array<{ title: string; count: number }>
   }
   breakdowns: {
     revenueByCategory: Array<{ name: string; revenue: number }>
     revenueByVendor: Array<{ email: string; revenue: number }>
     revenueByBrand: Array<{ name: string; revenue: number }>
   }
   charts: {
     ordersOverTime: Array<{ date: string; revenue: number }>
     bookingsOverTime: Array<{ date: string; count: number }>
     customerGrowthOverTime: Array<{ date: string; count: number }>
     marketplaceActivity: Array<{ date: string; orders: number; bookings: number; revenue: number }>
     monthlyComparison: Array<{ month: string; revenue: number; orders: number; bookings: number }>
   }
 }

 export default function SuperAdminDashboard() {
   try {
   const [stats, setStats] = useState<PlatformStats | null>(null)
   const [admins, setAdmins] = useState<AdminUser[]>([])
   const [vendors, setVendors] = useState<Vendor[]>([])
   const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])
   const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
   const [analyticsLoading, setAnalyticsLoading] = useState(false)
   const [loading, setLoading] = useState(true)
   const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [statsRes, adminsRes, vendorsRes, supportRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users?role=ADMIN'),
        fetch('/api/admin/vendors'),
        fetch('/api/admin/support'),
      ])

      if (!statsRes.ok || !adminsRes.ok || !vendorsRes.ok || !supportRes.ok) {
        setError('Failed to load dashboard data')
        return
      }

      const statsData = await statsRes.json()
      const adminsData = await adminsRes.json()
      const vendorsData = await vendorsRes.json()
      const supportData = await supportRes.json()

      setStats(statsData.stats)
      setAdmins(adminsData.users || [])
      setVendors(vendorsData.vendors || [])
      setSupportTickets(supportData.tickets || [])
    } catch (err) {
      setError('Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true)
      const res = await fetch('/api/analytics/super-admin?range=thismonth')
      if (res.ok) {
        const data = await res.json()
        setAnalytics(data.analytics || null)
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

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
            <Button onClick={fetchData} variant="primary">
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
      <div className="bg-gradient-to-br from-deep-navy via-purple-900 to-royal-blue py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Platform Command Center
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              Super Admin Dashboard
            </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
                Full ecosystem visibility, governance controls, and financial oversight for the entire platform.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10">
          {/* Platform Overview Stats - Mobile Responsive */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-slate-500 truncate">Total Users</p>
                    <p className="text-lg sm:text-2xl font-bold text-deep-navy truncate">{(stats?.totalUsers ?? 0).toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-deep-navy">{(stats?.totalVendors ?? 0).toLocaleString()}</p>
                   <p className="text-xs text-emerald-600 font-medium">
                     {(stats?.verifiedVendors ?? 0).toLocaleString()} verified
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
                  <p className="text-2xl font-bold text-deep-navy">{(stats?.totalProducts ?? 0).toLocaleString()}</p>
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
                  <p className="text-2xl font-bold text-deep-navy">{(stats?.totalOrders ?? 0).toLocaleString()}</p>
                   <p className="text-xs text-slate-500">{(stats?.paidOrderCount ?? 0).toLocaleString()} paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Command Center */}
        <Card variant="elevated" className="mb-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-royal-blue/90 to-purple-900/90"></div>
          <CardContent className="p-8 relative">
            <div className="space-y-6">
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-white/90 mb-4">Financial Command Center</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-300">
                  <div>
                    <p className="text-sm font-medium">Gross Sales</p>
                    <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalGrossAmount ?? 0)}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium">Processor Fees</p>
                     <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalProcessorFee ?? 0)}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium">Platform Commission</p>
                     <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalPlatformCommission ?? 0)}</p>
                   </div>
                   <div>
                     <p className="text-sm font-medium">Vendor Earnings</p>
                     <p className="text-2xl font-bold text-white">{formatCurrency(stats?.totalVendorEarnings ?? 0)}</p>
                   </div>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white/90 mb-2">Total Platform Revenue</h3>
                  <p className="text-4xl sm:text-5xl font-bold text-white mb-2">
                     {formatCurrency(stats?.totalRevenue ?? 0)}
                    </p>
                    <p className="text-slate-300">
                      From {(stats?.paidOrderCount ?? 0).toLocaleString()} paid orders
                    </p>
                  </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                    Export Report
                  </Button>
                  <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10" onClick={fetchData}>
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
               <p className="text-3xl font-bold text-deep-navy">{(stats?.totalCategories ?? 0).toLocaleString()}</p>
                <p className="text-sm text-slate-500 mt-1">Product categories</p>
              </CardContent>
            </Card>

           <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
             <CardContent className="p-6">
               <p className="text-sm text-slate-500 mb-1">Reviews</p>
               <p className="text-3xl font-bold text-deep-navy">{(stats?.totalReviews ?? 0).toLocaleString()}</p>
               <p className="text-sm text-slate-500 mt-1">Customer reviews</p>
             </CardContent>
           </Card>

           <Card variant="outline" className="hover:border-royal-blue/30 transition-colors">
             <CardContent className="p-6">
               <p className="text-sm text-slate-500 mb-1">Verified Vendors</p>
               <p className="text-3xl font-bold text-deep-navy">{(stats?.verifiedVendors ?? 0).toLocaleString()}</p>
               <p className="text-sm text-slate-500 mt-1">
                 {stats?.totalVendors ? Math.round(((stats?.verifiedVendors ?? 0) / stats.totalVendors) * 100) : 0}% of vendors
               </p>
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
         </div>

         {/* Marketplace Analytics */}
         <div className="mb-8">
           <h2 className="text-2xl font-bold text-deep-navy mb-6">Marketplace Analytics</h2>
           {analyticsLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
               {[...Array(8)].map((_, i) => (
                 <SkeletonCard key={i} />
               ))}
             </div>
           ) : analytics ? (
             <>
               {/* Analytics KPI Cards */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                 <MetricCard label="Revenue Today" value={formatCurrency(analytics.kpis.todayRevenue)} trend="up" />
                 <MetricCard label="Revenue This Week" value={formatCurrency(analytics.kpis.weeklyRevenue)} trend="up" />
                 <MetricCard label="Revenue This Month" value={formatCurrency(analytics.kpis.monthlyRevenue)} trend="up" />
                 <MetricCard label="Revenue This Year" value={formatCurrency(analytics.kpis.yearlyRevenue)} trend="up" />
                 <MetricCard label="Orders" value={formatNumber(analytics.kpis.totalOrders)} trend="neutral" />
                 <MetricCard label="Completed Orders" value={formatNumber(analytics.kpis.completedOrders)} trend="up" />
                 <MetricCard label="Pending Orders" value={formatNumber(analytics.kpis.pendingOrders)} trend="neutral" />
                 <MetricCard label="Service Bookings" value={formatNumber(analytics.kpis.totalBookings)} trend="neutral" />
                 <MetricCard label="Customer Growth" value={`+${analytics.kpis.customerGrowth}`} trend="up" />
                 <MetricCard label="Vendor Growth" value={`+${analytics.kpis.vendorGrowth}`} trend="up" />
               </div>

               {/* Charts */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                 <ChartCard title="Revenue Line Chart" icon="📈">
                   <ResponsiveContainer width="100%" height={300}>
                     <AreaChart data={analytics.charts.ordersOverTime ?? []}>
                       <defs>
                         <linearGradient id="superAdminRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                           <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                         </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                       <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                       <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `GH₵${v}`} />
                       <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
                       <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#superAdminRevenueGradient)" name="Revenue" />
                     </AreaChart>
                   </ResponsiveContainer>
                 </ChartCard>

                 <ChartCard title="Orders Chart" icon="📊">
                   <ResponsiveContainer width="100%" height={300}>
                     <BarChart data={analytics.charts.monthlyComparison ?? []}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                       <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                       <YAxis tick={{ fontSize: 12 }} />
                       <Tooltip />
                       <Legend />
                       <Bar dataKey="orders" fill="#2563EB" name="Orders" radius={[4, 4, 0, 0]} />
                       <Bar dataKey="revenue" fill="#10B981" name="Revenue" radius={[4, 4, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </ChartCard>

                 <ChartCard title="Bookings Chart" icon="📋">
                   <ResponsiveContainer width="100%" height={300}>
                     <AreaChart data={analytics.charts.bookingsOverTime ?? []}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                       <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                       <YAxis tick={{ fontSize: 12 }} />
                       <Tooltip />
                       <Area type="monotone" dataKey="count" stroke="#C89B2B" strokeWidth={2} fill="#C89B2B" fillOpacity={0.1} name="Bookings" />
                     </AreaChart>
                   </ResponsiveContainer>
                 </ChartCard>

                 <ChartCard title="Category Distribution" icon="🥧">
                   <ResponsiveContainer width="100%" height={300}>
                     <PieChart>
                       <Pie data={analytics.breakdowns.revenueByCategory ?? []} cx="50%" cy="50%" outerRadius={100} dataKey="revenue" nameKey="name" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>
                         {(analytics.breakdowns.revenueByCategory ?? []).map((entry, index) => (
                           <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
                     </PieChart>
                   </ResponsiveContainer>
                 </ChartCard>

                 <ChartCard title="Vendor Performance" icon="🏪">
                   <ResponsiveContainer width="100%" height={300}>
                     <BarChart data={(analytics.breakdowns.revenueByVendor ?? []).slice(0, 10)} layout="horizontal">
                       <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                       <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `GH₵${v}`} />
                       <YAxis type="category" dataKey="email" tick={{ fontSize: 12 }} width={120} />
                       <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
                       <Bar dataKey="revenue" fill="#2563EB" radius={[0, 4, 4, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </ChartCard>
               </div>

               {/* Rankings */}
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                 <RankingCard title="Top Vendors" data={analytics.rankings.topVendors ?? []} />
                 <RankingCard title="Top Products" data={analytics.rankings.topProducts ?? []} />
                 <RankingCard title="Top Services" data={analytics.rankings.topServices ?? []} />
               </div>
             </>
           ) : (
             <Card>
               <CardContent className="text-center py-8">
                 <p className="text-gray-500">Analytics data is not available at this time.</p>
               </CardContent>
             </Card>
           )}
         </div>

         {/* Employee/Admin Management & Vendor Governance - Mobile Responsive */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card variant="elevated">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                <h3 className="text-lg font-semibold text-deep-navy">Employee / Admin Management</h3>
                <Button asChild variant="primary" size="sm" className="w-full sm:w-auto min-h-[44px]">
                  <Link href="/dashboard/admin/create-admin">Create Admin</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {admins.length === 0 ? (
                  <EmptyState
                    icon={
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    }
                    title="No admins found"
                    description="Admin accounts will appear here."
                    className="py-6"
                  />
                ) : (
                  <div className="space-y-3">
                    {admins.slice(0, 5).map((admin) => (
                      <div key={admin.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors gap-3">
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                              {admin.profile?.firstName?.charAt(0) || admin.profile?.lastName?.charAt(0) || admin.email?.charAt(0) || ''}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-700 break-words">
                                {admin.profile?.firstName && admin.profile?.lastName 
                                  ? `${admin.profile.firstName} ${admin.profile.lastName}` 
                                  : admin.email}
                              </p>
                              <p className="text-xs text-slate-500 break-all">{admin.email}</p>
                              {admin.mobileNumber && (
                                <p className="text-xs text-slate-400 mt-1">{admin.mobileNumber}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant="info" className="w-full sm:w-auto text-center sm:text-left">ADMIN</Badge>
                        </div>
                ))}
                      </div>
                  )}
                <Button asChild variant="ghost" className="w-full min-h-[44px]">
                  <Link href="/dashboard/admin/users">View All Admins</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                <h3 className="text-lg font-semibold text-deep-navy">Vendor Governance</h3>
                <Button asChild variant="primary" size="sm" className="w-full sm:w-auto min-h-[44px]">
                  <Link href="/dashboard/admin/vendors">Manage Vendors</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {vendors.length === 0 ? (
                  <EmptyState
                    icon={
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    }
                    title="No vendors found"
                    description="Vendors will appear here."
                    className="py-6"
                  />
                ) : (
                  <div className="space-y-3">
                    {vendors.slice(0, 5).map((vendor) => (
                      <div key={vendor.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors gap-3">
                        <div className="flex items-start sm:items-center gap-3 min-w-0">
<div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                            {(vendor.storeName || vendor.store?.name)?.charAt(0) || vendor.email?.charAt(0) || ''}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-700 break-words">
                              {vendor.storeName || vendor.name || 'Unnamed Store'}
                            </p>
                            <p className="text-xs text-slate-500 break-all">{vendor.email}</p>
                            {vendor.mobileNumber && (
                              <p className="text-xs text-slate-400 mt-1">{vendor.mobileNumber}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-1 w-full sm:w-auto">
                          {vendor.store?.isVerified && (
                            <Badge variant="success" className="text-center">Verified</Badge>
                          )}
                          {vendor.store?.isFeatured && (
                            <Badge variant="premium" className="text-center">Featured</Badge>
                          )}
                          {(!vendor.store?.isVerified && !vendor.store?.isFeatured) && (
                            <Badge variant="default" className="text-center">Pending</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button asChild variant="ghost" className="w-full min-h-[44px]">
                  <Link href="/dashboard/admin/vendors">View All Vendors</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Health & Support */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card variant="elevated">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-deep-navy mb-4">Platform Health</h3>
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
                   <span className="text-royal-blue text-sm font-semibold">Dhream Market v1</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
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
                          <p className="text-xs text-slate-500">{ticket.user.email}</p>
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
        </div>

        {/* Quick Actions */}
        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                 <Link href="/dashboard/super-admin/product-categories">
                   <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                     </svg>
                   </div>
                   <span className="text-sm font-medium text-slate-700">Product Categories</span>
                 </Link>
               </Button>
<Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/super-admin/homepage">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                       </svg>
                     </div>
                    <span className="text-sm font-medium text-slate-700">Create Admin</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="flex flex-col items-center gap-2 p-4 hover:bg-slate-50 group w-full">
                  <Link href="/dashboard/super-admin/settings">
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

          {/* Governance Navigation */}
        <Card variant="elevated" className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-deep-navy mb-4">Governance Navigation</h3>
            <p className="text-sm text-slate-500 mb-6">Direct access to all platform management sections</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Link href="/dashboard/admin/users" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700 transition-colors">Manage Users</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/vendors" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">Manage Vendors</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/vendor-categories" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-purple-700 transition-colors">Vendor Categories</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/orders" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-amber-700 transition-colors">View Orders</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/payments" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">Payments & Revenue</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/products" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-purple-700 transition-colors">Manage Products</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/support" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-rose-50 hover:border-rose-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-rose-700 transition-colors">Support Tickets</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/create-admin" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">Create Admin</span>
                </div>
              </Link>
              <Link href="/dashboard/super-admin/homepage" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-violet-700 transition-colors">Homepage Sections</span>
                </div>
              </Link>
              <Link href="/dashboard/super-admin/brands" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-violet-700 transition-colors">Brand Management</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/categories" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-cyan-50 hover:border-cyan-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-cyan-700 transition-colors">Platform Analytics</span>
                </div>
              </Link>
              <Link href="/dashboard/super-admin/product-categories" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-cyan-50 hover:border-cyan-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-cyan-700 transition-colors">Product Categories</span>
                </div>
              </Link>
              {/* Services Section */}
              <div className="col-span-full mt-4 mb-2">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">Services</h3>
              </div>
              <Link href="/dashboard/super-admin/service-categories" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-violet-700 transition-colors">Service Categories</span>
                </div>
              </Link>
              <Link href="/dashboard/super-admin/service-requests" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-violet-700 transition-colors">Service Requests</span>
                </div>
              </Link>
              <Link href="/dashboard/admin/verification-applications" className="group">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 border border-transparent transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-700 transition-colors">Verify Vendors</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
</div>
     </div>
   )
} catch (error) {
        throw error
      }
    }

 const COLORS = [
   '#0B1F3A', '#2563EB', '#C89B2B', '#10B981', '#F59E0B',
   '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1',
 ]

 function formatNumber(num: number) {
   return num.toLocaleString()
 }

 function formatCurrency(amount: number) {
   return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)
 }

 function MetricCard({ label, value, trend }: { label: string; value: string | number; trend: 'up' | 'down' | 'neutral' }) {
   const trendColors = { up: 'text-emerald-600', down: 'text-rose-600', neutral: 'text-slate-500' }
   const trendIcons = { up: '↑', down: '↓', neutral: '→' }
   return (
     <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
       <CardContent className="p-4 sm:p-6">
         <p className="text-xs sm:text-sm text-slate-500 mb-1">{label}</p>
         <div className="flex items-baseline gap-2">
           <p className="text-xl sm:text-2xl font-bold text-deep-navy">{value}</p>
           <span className={`text-sm font-medium ${trendColors[trend]}`}>{trendIcons[trend]}</span>
         </div>
       </CardContent>
     </Card>
   )
 }

 function ChartCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
   return (
     <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
       <CardHeader>
         <div className="flex items-center gap-2">
           <span className="text-xl">{icon}</span>
           <h3 className="text-lg font-semibold text-deep-navy">{title}</h3>
         </div>
       </CardHeader>
       <CardContent>{children}</CardContent>
     </Card>
   )
 }

 function RankingCard({ title, data }: { title: string; data: Array<{ name?: string; email?: string; revenue?: number; count?: number; orderCount?: number; views?: number }> }) {
   return (
     <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
       <CardHeader>
         <h3 className="text-lg font-semibold text-deep-navy">{title}</h3>
       </CardHeader>
       <CardContent>
         {data.length === 0 ? (
           <p className="text-slate-400 text-sm text-center py-4">No data available</p>
         ) : (
           <div className="space-y-3">
             {data.slice(0, 10).map((item, index) => (
               <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                 <div className="flex items-center gap-3">
                   <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index < 3 ? 'bg-royal-blue text-white' : 'bg-slate-200 text-slate-600'}`}>
                     {index + 1}
                   </span>
                   <span className="text-sm font-medium text-deep-navy truncate max-w-[120px]">
                     {item.name || item.email || 'N/A'}
                   </span>
                 </div>
                 <span className="text-sm font-semibold text-royal-blue">
                   {item.revenue !== undefined ? formatCurrency(item.revenue) :
                     item.count !== undefined ? formatNumber(item.count) :
                     item.orderCount !== undefined ? formatNumber(item.orderCount) :
                     item.views !== undefined ? formatNumber(item.views) : 'N/A'}
                 </span>
               </div>
             ))}
           </div>
         )}
       </CardContent>
     </Card>
)
  }
