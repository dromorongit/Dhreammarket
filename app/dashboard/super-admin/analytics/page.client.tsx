'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, ReferenceLine
} from 'recharts'

type AnalyticsData = {
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

const COLORS = [
  '#0B1F3A', '#2563EB', '#C89B2B', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1',
]

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thismonth', label: 'This Month' },
  { value: 'lastmonth', label: 'Last Month' },
  { value: 'thisyear', label: 'This Year' },
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount)
}

function formatNumber(num: number) {
  return num.toLocaleString()
}

function formatPercent(num: number) {
  return `${num.toFixed(2)}%`
}

export default function SuperAdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState('thismonth')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let url = `/api/analytics/super-admin?range=${range}`
      if (range === 'custom') {
        if (customFrom) url += `&from=${customFrom}`
        if (customTo) url += `&to=${customTo}`
      }

      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      const json = await res.json()
      setData(json.analytics)
    } catch (err) {
      setError('Failed to load analytics data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [range, customFrom, customTo])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const handleExport = async (type: string) => {
    try {
      let apiUrl = `/api/analytics/super-admin?range=${range}&export=${type}`
      if (range === 'custom') {
        if (customFrom) apiUrl += `&from=${customFrom}`
        if (customTo) apiUrl += `&to=${customTo}`
      }
      const res = await fetch(apiUrl)
      const json = await res.json()
      const csvData = json.data
      if (!csvData || csvData.length === 0) return

      const headers = Object.keys(csvData[0])
      const csv = [
        headers.join(','),
        ...csvData.map((row: any) => headers.map((h) => `"${row[h] ?? ''}"`).join(',')),
      ].join('\n')

      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-${range}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="h-10 bg-slate-200 rounded-lg w-64 mb-8 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-24 mb-3"></div>
                <div className="h-8 bg-slate-200 rounded w-32"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchAnalytics} variant="primary">Retry</Button>
          </div>
        </div>
      </div>
    )
  }

  const kpis = data?.kpis
  const charts = data?.charts
  const rankings = data?.rankings
  const breakdowns = data?.breakdowns

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Enterprise Analytics</h1>
            <p className="text-slate-500 mt-1">Real-time marketplace performance insights</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-deep-navy bg-white focus:outline-none focus:ring-2 focus:ring-royal-blue"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
            {range === 'custom' && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-deep-navy"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-deep-navy"
                />
              </>
            )}
            <Button variant="outline" size="sm" onClick={fetchAnalytics}>Refresh</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Revenue" value={formatCurrency(kpis?.totalRevenue ?? 0)} trend="up" />
          <MetricCard label="Today's Revenue" value={formatCurrency(kpis?.todayRevenue ?? 0)} trend="up" />
          <MetricCard label="Weekly Revenue" value={formatCurrency(kpis?.weeklyRevenue ?? 0)} trend="up" />
          <MetricCard label="Monthly Revenue" value={formatCurrency(kpis?.monthlyRevenue ?? 0)} trend="up" />
          <MetricCard label="Yearly Revenue" value={formatCurrency(kpis?.yearlyRevenue ?? 0)} trend="up" />
          <MetricCard label="Total Orders" value={formatNumber(kpis?.totalOrders ?? 0)} trend="neutral" />
          <MetricCard label="Completed Orders" value={formatNumber(kpis?.completedOrders ?? 0)} trend="up" />
          <MetricCard label="Pending Orders" value={formatNumber(kpis?.pendingOrders ?? 0)} trend="neutral" />
          <MetricCard label="Cancelled Orders" value={formatNumber(kpis?.cancelledOrders ?? 0)} trend="down" />
          <MetricCard label="Total Bookings" value={formatNumber(kpis?.totalBookings ?? 0)} trend="neutral" />
          <MetricCard label="Completed Bookings" value={formatNumber(kpis?.completedBookings ?? 0)} trend="up" />
          <MetricCard label="Pending Bookings" value={formatNumber(kpis?.pendingBookings ?? 0)} trend="neutral" />
          <MetricCard label="Vendor Growth" value={`+${kpis?.vendorGrowth ?? 0}`} trend="up" />
          <MetricCard label="Customer Growth" value={`+${kpis?.customerGrowth ?? 0}`} trend="up" />
          <MetricCard label="Active Users" value={formatNumber(kpis?.activeUsers ?? 0)} trend="neutral" />
          <MetricCard label="DAU" value={formatNumber(kpis?.dailyActiveUsers ?? 0)} trend="neutral" />
          <MetricCard label="MAU" value={formatNumber(kpis?.monthlyActiveUsers ?? 0)} trend="neutral" />
          <MetricCard label="Conversion Rate" value={formatPercent(kpis?.conversionRate ?? 0)} trend="up" />
          <MetricCard label="Avg Order Value" value={formatCurrency(kpis?.averageOrderValue ?? 0)} trend="neutral" />
          <MetricCard label="Repeat Customers" value={formatPercent(kpis?.repeatCustomerPercentage ?? 0)} trend="up" />
          <MetricCard label="Products Sold" value={formatNumber(kpis?.productsSold ?? 0)} trend="up" />
          <MetricCard label="Services Booked" value={formatNumber(kpis?.servicesBooked ?? 0)} trend="up" />
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button variant="outline" size="sm" onClick={() => handleExport('revenue')}>Export Revenue CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('orders')}>Export Orders CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('bookings')}>Export Bookings CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('customers')}>Export Customers CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('vendors')}>Export Vendors CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('products')}>Export Products CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('services')}>Export Services CSV</Button>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ChartCard title="Revenue Trend" icon="📈">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={charts?.ordersOverTime ?? []}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `GH₵${v}`} />
                <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revenueGradient)" name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Orders & Bookings" icon="📊">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={charts?.marketplaceActivity ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="orders" fill="#2563EB" name="Orders" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="bookings" fill="#10B981" name="Bookings" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#C89B2B" strokeWidth={2} name="Revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Category Revenue" icon="🥧">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={breakdowns?.revenueByCategory ?? []} cx="50%" cy="50%" outerRadius={100} dataKey="revenue" nameKey="name" label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {(breakdowns?.revenueByCategory ?? []).map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Vendor Performance" icon="🏪">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(breakdowns?.revenueByVendor ?? []).slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `GH₵${v}`} />
                <YAxis type="category" dataKey="email" tick={{ fontSize: 12 }} width={120} />
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Customer Growth" icon="👥">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={charts?.customerGrowthOverTime ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(d) => new Date(d).toLocaleDateString()} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981' }} name="New Customers" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Monthly Comparison" icon="📅">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={charts?.monthlyComparison ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `GH₵${v}`} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#2563EB" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="orders" fill="#10B981" name="Orders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <RankingCard title="Top Categories" data={rankings?.topCategories ?? []} />
          <RankingCard title="Top Products" data={rankings?.topProducts ?? []} />
          <RankingCard title="Top Services" data={rankings?.topServices ?? []} />
          <RankingCard title="Top Vendors" data={rankings?.topVendors ?? []} />
          <RankingCard title="Top Brands" data={rankings?.topBrands ?? []} />
          <RankingCard title="Most Viewed Products" data={rankings?.mostViewedProducts ?? []} />
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, trend }: { label: string; value: string | number; trend: 'up' | 'down' | 'neutral' }) {
  const trendColors = { up: 'text-emerald-600', down: 'text-rose-600', neutral: 'text-slate-500' }
  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  }
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

function RankingCard({ title, data }: { title: string; data: Array<{ name?: string; email?: string; revenue?: number; count?: number; salesCount?: number; orderCount?: number; views?: number }> }) {
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
                    item.salesCount !== undefined ? formatNumber(item.salesCount) :
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