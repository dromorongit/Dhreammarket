'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import Link from 'next/link'

interface Order {
  id: string
  total: number
  status: string
  paymentStatus: string
  createdAt: string
  user: {
    id: string
    email: string
    role: string
  }
  _count: {
    items: number
  }
  payment?: {
    id: string
    status: string
    amount: number
    reference: string
  }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ status: '', paymentStatus: '' })
  const [summary, setSummary] = useState({ byStatus: [], byPaymentStatus: [] })
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (filters.status) params.set('status', filters.status)
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)

      const response = await fetch(`/api/admin/orders?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to load orders')
        return
      }
      
      setOrders(data.orders)
      setPagination(prev => ({ ...prev, ...data.pagination }))
      setSummary(data.summary)
    } catch (err) {
      setError('Failed to fetch orders')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters.status, filters.paymentStatus])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
    }).format(amount)
  }

  const getStatusBadge = (status: string, type: 'order' | 'payment') => {
    if (type === 'order') {
      const colors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        PROCESSING: 'bg-blue-100 text-blue-800',
        SHIPPED: 'bg-purple-100 text-purple-800',
        DELIVERED: 'bg-green-100 text-green-800',
        COMPLETED: 'bg-green-100 text-green-800',
        CANCELLED: 'bg-red-100 text-red-800',
      }
      return colors[status] || 'bg-gray-100 text-gray-800'
    } else {
      const colors: Record<string, string> = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        PAID: 'bg-green-100 text-green-800',
        FAILED: 'bg-red-100 text-red-800',
        CANCELLED: 'bg-red-100 text-red-800',
        REFUNDED: 'bg-purple-100 text-purple-800',
      }
      return colors[status] || 'bg-gray-100 text-gray-800'
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (actionLoading) return

    if (!confirm('Are you sure you want to delete this order? This action cannot be undone and will remove the order from the system.')) {
      return
    }

    try {
      setActionLoading(orderId)
      const response = await fetch(`/api/admin/orders?orderId=${orderId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to delete order')
        return
      }

      // Remove the order from the list
      setOrders(prev => prev.filter(order => order.id !== orderId))
      // Update pagination total
      setPagination(prev => ({ ...prev, total: prev.total - 1 }))
    } catch (err) {
      alert('Failed to delete order')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button onClick={fetchOrders} className="mt-2 text-sm text-red-600 hover:underline">
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-600 mt-1">Track all platform orders</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {summary.byStatus?.map((s: { status: string; _count: number }) => (
            <Card key={s.status}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-gray-900">{s._count}</p>
                <p className="text-sm text-gray-600">{s.status}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={(e) => { e.preventDefault(); setPagination(prev => ({ ...prev, page: 1 })); fetchOrders(); }} className="flex flex-wrap gap-4">
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Order Status</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={filters.paymentStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Payment Status</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="REFUNDED">Refunded</option>
              </select>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Filter
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Order List</h2>
              <span className="text-sm text-gray-600">{pagination.total} orders</span>
            </div>
          </CardHeader>
          {loading ? (
            <CardContent className="p-8 text-center">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          ) : orders.length === 0 ? (
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-500">Orders will appear here when customers make purchases.</p>
            </CardContent>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <Link 
                            href={`/dashboard/admin/orders?id=${order.id}`}
                            className="text-sm font-mono text-blue-600 hover:underline"
                          >
                            {order.id.slice(0, 8)}...
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{order.user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(order.total)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{order._count.items}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status, 'order')}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {order.payment ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.payment.status, 'payment')}`}>
                              {order.payment.status}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">No payment</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {actionLoading === order.id ? (
                            <span className="text-sm text-gray-500">Processing...</span>
                          ) : (
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="text-sm text-red-600 hover:text-red-800"
                              title="Delete order"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}