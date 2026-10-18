'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { Badge } from '@/components/Badge'
import { formatPrice } from '@/lib/currency'
import { cancelledOrderLabel } from '@/lib/order-sale-filter'

interface OrderItem {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
  }
}

interface Order {
  id: string
  total: number
  status: string
  paymentStatus: string
  createdAt: string
  updatedAt: string
  vendorAccepted: boolean
  vendorRejected: boolean
  vendorTotal: number
  items: OrderItem[]
  user: {
    id: string
    email: string
    profile: {
      firstName: string | null
      lastName: string | null
    } | null
  }
  payment: {
    id: string
    status: string
    reference: string
    amount: number
  } | null
  source: string
  channel: string | null
  customerName?: string | null
  customerPhone?: string | null
  paymentMethod?: string | null
  receiptToken?: string | null
  receiptUrl?: string | null
  displayNumber?: string
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: 'Processing', color: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-800' },
  DELIVERED: { label: 'Delivered', color: 'bg-indigo-100 text-indigo-800' },
  COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
}

const VENDOR_ACCEPTANCE_CONFIG: Record<string, { label: string; color: string }> = {
  ACCEPTED: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  PENDING: { label: 'Pending Acceptance', color: 'bg-yellow-100 text-yellow-800' },
}

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  ONLINE: { label: 'Online', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  MANUAL: { label: 'Manual', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

const MANUAL_STATUS_TRANSITIONS: Record<string, string[]> = {
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  PENDING: [],
}

export default function VendorOrdersPageClient() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Manual order action state
  const [manualOrderId, setManualOrderId] = useState<string | null>(null)
  const [manualAction, setManualAction] = useState<'pay' | 'ship' | 'deliver' | 'complete' | 'cancel' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [page, search, statusFilter, sourceFilter, unpaidOnly])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        status: statusFilter,
      })
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      if (unpaidOnly) params.set('unpaid', 'true')

      const response = await fetch(`/api/vendor/orders?${params}`)

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load orders')
        return
      }

      const data = await response.json()
      setOrders(data.orders || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      console.error('Error fetching orders:', err)
      setError('An error occurred while loading orders')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchOrders()
  }

  const normalizeSearch = (value: string) => value.trim().replace(/^#+/, '')

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(normalizeSearch(e.target.value))
  }

  const getCustomerName = (order: Order) => {
    if (order.customerName) return order.customerName
    if (order.user.profile?.firstName || order.user.profile?.lastName) {
      return [order.user.profile?.firstName, order.user.profile?.lastName].filter(Boolean).join(' ')
    }
    return order.user.email.split('@')[0]
  }

  const isManual = (order: Order) => order.source === 'MANUAL'

  const allowedManualStatuses = (order: Order) => MANUAL_STATUS_TRANSITIONS[order.status] || []

  const handleManualAction = (orderId: string, action: 'pay' | 'ship' | 'deliver' | 'complete' | 'cancel') => {
    setManualOrderId(orderId)
    setManualAction(action)
    setPaymentMethod(null)
    setCancelConfirm(false)
  }

  const handleConfirmPay = () => {
    if (!manualOrderId) return
    setUpdatingOrder(manualOrderId)
    fetch(`/api/vendor/manual-orders/${manualOrderId}/confirm-payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: paymentMethod || 'CASH' }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to confirm payment')
        setOrders((prev) => prev.map((o) => o.id === manualOrderId ? { ...o, paymentStatus: 'PAID', paymentMethod: paymentMethod || 'CASH' } : o))
        closeManualAction()
      })
      .catch((err) => {
        alert(err instanceof Error ? err.message : 'Failed to confirm payment')
        setUpdatingOrder(null)
      })
  }

  const handleUpdateStatus = async (status: string) => {
    if (!manualOrderId) return
    setUpdatingOrder(manualOrderId)
    try {
      const res = await fetch(`/api/vendor/manual-orders/${manualOrderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update order')
      setOrders((prev) => prev.map((o) => o.id === manualOrderId ? { ...o, status: data.order.status, fulfillmentStatus: data.order.fulfillmentStatus } : o))
      closeManualAction()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update order')
      setUpdatingOrder(null)
    }
  }

  const handleCancelSale = () => {
    if (!manualOrderId) return
    setCancelConfirm(true)
  }

  const handleConfirmCancel = () => {
    if (!manualOrderId) return
    setUpdatingOrder(manualOrderId)
    handleUpdateStatus('CANCELLED')
    setCancelConfirm(false)
  }

  const closeManualAction = () => {
    setManualOrderId(null)
    setManualAction(null)
    setPaymentMethod(null)
    setCancelConfirm(false)
    setUpdatingOrder(null)
  }

  const handleShareReceipt = (order: Order) => {
    if (!order.receiptUrl) return
    navigator.clipboard.writeText(order.receiptUrl)
  }

  const handleWhatsAppReceipt = (order: Order) => {
    if (!order.receiptUrl || !order.customerPhone) return
    const link = `https://wa.me/${order.customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Your receipt: ${order.receiptUrl}`)}`
    window.open(link, '_blank')
  }

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Orders</h2>
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard/vendor"
              className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center mb-4"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
            <p className="text-gray-600 mt-1">Manage orders for your products</p>
          </div>
          <Button asChild variant="primary" size="sm" className="min-h-[44px]">
            <Link href="/dashboard/vendor/quick-sale">New sale</Link>
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <form onSubmit={handleSearch} className="flex-1 min-w-0">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search by order ID or customer..."
                    value={search}
                    onChange={handleSearchChange}
                    className="w-full"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                  </button>
                </div>
              </form>
              <select
                value={statusFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setStatusFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full sm:w-48 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
              >
                <option value="all">All Statuses</option>
                <option value="PROCESSING">Processing</option>
                <option value="SHIPPED">Shipped</option>
                <option value="DELIVERED">Delivered</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={sourceFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setSourceFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full sm:w-48 rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
              >
                <option value="all">All Sources</option>
                <option value="ONLINE">Online</option>
                <option value="MANUAL">Manual</option>
              </select>
              <Button
                variant={unpaidOnly ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setUnpaidOnly(!unpaidOnly)}
                className="min-h-[44px] flex-1 sm:flex-none"
              >
                {unpaidOnly ? 'Showing Unpaid' : 'Unpaid Only'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
              <p className="text-gray-600">
                {search || statusFilter !== 'all' || sourceFilter !== 'all' || unpaidOnly
                  ? 'Try adjusting your search or filters'
                  : 'You don\'t have any orders yet. Orders will appear here when customers purchase your products.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => {
                const statusConfig = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG]
                const acceptanceConfig = VENDOR_ACCEPTANCE_CONFIG[order.vendorAccepted ? 'ACCEPTED' : order.vendorRejected ? 'REJECTED' : 'PENDING']
                const statusLabel =
                  order.status === 'CANCELLED'
                    ? cancelledOrderLabel(order)
                    : statusConfig?.label || order.status
                const sourceConfig = SOURCE_BADGE[order.source as keyof typeof SOURCE_BADGE] || { label: order.source, color: 'bg-gray-100 text-gray-800' }

                return (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium text-gray-500">Order #{order.id.slice(-8).toUpperCase()}</span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${sourceConfig.color}`}>
                              {sourceConfig.label}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusConfig?.color || 'bg-gray-100 text-gray-800'}`}>
                              {statusLabel}
                            </span>
                            {!isManual(order) && (
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${acceptanceConfig?.color || 'bg-gray-100 text-gray-800'}`}>
                                {acceptanceConfig?.label || 'Pending'}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900 truncate">{getCustomerName(order)}</p>
                          {isManual(order) && order.customerPhone && (
                            <p className="text-sm text-gray-600">{order.customerPhone}</p>
                          )}
                          {!isManual(order) && (
                            <p className="text-sm text-gray-600">{order.user.email}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(order.createdAt).toLocaleDateString('en-GH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Your Total</p>
                          <p className="text-xl font-bold text-gray-900">{formatPrice(order.vendorTotal)}</p>
                          <p className="text-xs text-gray-500">{order.items.length} item(s)</p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="min-h-[44px]">
                          <Link href={`/dashboard/vendor/orders/${order.id}`}>View Details</Link>
                        </Button>

                        {/* Manual order actions */}
                        {isManual(order) && (
                          <div className="flex flex-wrap gap-2 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            {order.paymentStatus !== 'PAID' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManualAction(order.id, 'pay')}
                                disabled={updatingOrder === order.id}
                                className="min-h-[44px] text-xs px-3"
                              >
                                {updatingOrder === order.id && manualAction === 'pay' ? 'Confirming...' : 'Mark as paid'}
                              </Button>
                            )}
                            {allowedManualStatuses(order).includes('SHIPPED') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManualAction(order.id, 'ship')}
                                disabled={updatingOrder === order.id}
                                className="min-h-[44px] text-xs px-3"
                              >
                                {updatingOrder === order.id && manualAction === 'ship' ? 'Shipping...' : 'Mark shipped'}
                              </Button>
                            )}
                            {allowedManualStatuses(order).includes('DELIVERED') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManualAction(order.id, 'deliver')}
                                disabled={updatingOrder === order.id}
                                className="min-h-[44px] text-xs px-3"
                              >
                                {updatingOrder === order.id && manualAction === 'deliver' ? 'Delivering...' : 'Mark delivered'}
                              </Button>
                            )}
                            {allowedManualStatuses(order).includes('COMPLETED') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManualAction(order.id, 'complete')}
                                disabled={updatingOrder === order.id}
                                className="min-h-[44px] text-xs px-3"
                              >
                                {updatingOrder === order.id && manualAction === 'complete' ? 'Completing...' : 'Mark completed'}
                              </Button>
                            )}
                            {allowedManualStatuses(order).includes('CANCELLED') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelSale()}
                                disabled={updatingOrder === order.id}
                                className="min-h-[44px] text-xs px-3 text-rose-600 border-rose-200 hover:bg-rose-50"
                              >
                                Cancel sale
                              </Button>
                            )}
                            {order.receiptUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  handleShareReceipt(order)
                                  handleWhatsAppReceipt(order)
                                }}
                                disabled={updatingOrder === order.id}
                                className="min-h-[44px] text-xs px-3"
                              >
                                Share receipt
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} orders
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mark as paid dialog */}
      {manualOrderId && manualAction === 'pay' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark as Paid</h3>
              <p className="text-sm text-gray-600 mb-4">Select the payment method used.</p>
              <div className="space-y-2">
                {['MOBILE_MONEY', 'CASH', 'BANK_TRANSFER', 'OTHER'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
                      paymentMethod === m ? 'border-royal-blue bg-royal-blue/10 text-royal-blue' : 'border-slate-200 bg-white text-gray-700'
                    }`}
                  >
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <Button variant="outline" onClick={closeManualAction} disabled={updatingOrder === manualOrderId}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmPay} disabled={updatingOrder === manualOrderId || !paymentMethod} className="bg-royal-blue text-white">
                  {updatingOrder === manualOrderId ? 'Confirming...' : 'Confirm payment'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cancel sale dialog */}
      {manualOrderId && cancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Sale</h3>
              <p className="text-sm text-gray-600 mb-4">
                {(() => {
                  const cancellingOrder = orders.find((o) => o.id === manualOrderId)
                  const isPaid = cancellingOrder?.paymentStatus === 'PAID'
                  return isPaid
                    ? 'This sale was paid outside Dhream. Dhream does not process refunds for it. Refund the customer yourself. Stock will be restored.'
                    : 'Stock will be restored.'
                })()}
              </p>
              <div className="flex gap-3 justify-end mt-6">
                <Button variant="outline" onClick={() => setCancelConfirm(false)} disabled={updatingOrder === manualOrderId}>
                  Keep sale
                </Button>
                <Button onClick={handleConfirmCancel} disabled={updatingOrder === manualOrderId} variant="danger">
                  {updatingOrder === manualOrderId ? 'Cancelling...' : 'Cancel sale'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
