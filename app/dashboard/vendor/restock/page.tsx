'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'

interface RestockOrder {
  id: string
  productId: string
  productName: string
  quantityOrdered: number
  quantityReceived: number
  status: string
  expectedArrivalDate: string | null
  actualArrivalDate: string | null
  daysUntilArrival: number | null
  isOverdue: boolean
  createdAt: string
}

const RESTOCK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ORDERED: { label: 'Ordered', color: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800' },
  ARRIVED: { label: 'Arrived', color: 'bg-purple-100 text-purple-800' },
  RECEIVED: { label: 'Received', color: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
}

const RESTOCK_TRANSITIONS: Record<string, string[]> = {
  ORDERED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
}

export default function VendorRestockPage() {
  const [restockOrders, setRestockOrders] = useState<RestockOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [products, setProducts] = useState<Array<{ id: string; name: string; stock: number }>>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [expectedDate, setExpectedDate] = useState('')

  useEffect(() => {
    fetchRestockOrders()
    fetchProducts()
  }, [])

  const fetchRestockOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vendor/restock-orders')
      if (response.ok) {
        const data = await response.json()
        setRestockOrders(data.restockOrders || [])
      } else {
        setError('Failed to fetch restock orders')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/vendor/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products?.map((p: any) => ({ id: p.id, name: p.name, stock: p.stock })) || [])
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    }
  }

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingOrders(prev => new Set(prev).add(orderId))

    try {
      const response = await fetch(`/api/vendor/restock-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        await fetchRestockOrders()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update restock order')
      }
    } catch (err) {
      alert('Failed to update')
    } finally {
      setUpdatingOrders(prev => {
        const newSet = new Set(prev)
        newSet.delete(orderId)
        return newSet
      })
    }
  }

  const handleCreateRestock = async () => {
    if (!selectedProductId || quantity <= 0) {
      alert('Please select a product and enter quantity')
      return
    }

    try {
      const response = await fetch('/api/vendor/restock-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          quantityOrdered: quantity,
          expectedArrivalDate: expectedDate || undefined,
        }),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setSelectedProductId('')
        setQuantity(0)
        setExpectedDate('')
        await fetchRestockOrders()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create restock order')
      }
    } catch (err) {
      alert('Failed to create restock order')
    }
  }

  if (loading && restockOrders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/vendor"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Procurement & Restock</h1>
              <p className="text-gray-600 mt-1">Manage your restock orders and incoming inventory</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              + Create Restock Order
            </Button>
          </div>
        </div>

        {/* Create Restock Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Create Restock Order</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Product</label>
                    <select
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                    >
                      <option value="">Select a product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Current: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Quantity to Order</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                      min="1"
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                      placeholder="Enter quantity"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Expected Arrival Date</label>
                    <input
                      type="date"
                      value={expectedDate}
                      onChange={e => setExpectedDate(e.target.value)}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRestock} className="flex-1">
                    Create Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Restock Orders List */}
        {restockOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No restock orders</h3>
              <p className="text-gray-600 mb-4">Create your first restock order to manage incoming inventory.</p>
              <Button onClick={() => setShowCreateModal(true)}>Create Restock Order</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {restockOrders.map((order) => {
              const statusConfig = RESTOCK_STATUS_CONFIG[order.status] || RESTOCK_STATUS_CONFIG.ORDERED
              const nextStatuses = RESTOCK_TRANSITIONS[order.status] || []
              const isUpdating = updatingOrders.has(order.id)

              return (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                          {order.isOverdue && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900">{order.productName}</p>
                        <p className="text-sm text-gray-600">
                          Ordered: {order.quantityOrdered} units
                          {order.quantityReceived > 0 && ` • Received: ${order.quantityReceived} units`}
                        </p>
                        {order.expectedArrivalDate && (
                          <p className={`text-xs mt-1 ${order.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                            Expected Arrival: {order.expectedArrivalDate}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {nextStatuses.map(status => (
                          <button
                            key={status}
                            onClick={() => handleStatusUpdate(order.id, status)}
                            disabled={isUpdating}
                            className="px-3 py-1 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-50"
                          >
                            {isUpdating ? 'Updating...' : status.replace(/_/g, ' ')}
                          </button>
                        ))}
                        {nextStatuses.length > 0 && (
                          <select
                            onChange={e => {
                              if (e.target.value) handleStatusUpdate(order.id, e.target.value)
                              e.target.value = ''
                            }}
                            disabled={isUpdating}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            defaultValue=""
                          >
                            <option value="">Quick Update</option>
                            {nextStatuses.map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}