'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatPrice } from '@/lib/currency'

interface PurchaseOrder {
  id: string
  poNumber: string | null
  supplierId: string
  supplierName: string
  status: string
  totalCost: number
  expectedArrivalDate: string | null
  actualArrivalDate: string | null
  daysUntilArrival: number | null
  isOverdue: boolean
  createdAt: string
  isLinked: boolean
  items?: Array<{
    id: string
    productId: string
    quantity: number
    unitCost: number
    totalCost: number
    product?: { name: string }
  }>
}

interface Supplier {
  id: string
  companyName: string
}

interface Product {
  id: string
  name: string
  stock: number
}

const PO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-slate-100 text-slate-800' },
  ORDERED: { label: 'Ordered', color: 'bg-blue-100 text-blue-800' },
  SHIPPED: { label: 'Shipped', color: 'bg-indigo-100 text-indigo-800' },
  ARRIVED: { label: 'Arrived', color: 'bg-purple-100 text-purple-800' },
  RECEIVED: { label: 'Received', color: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
}

const PO_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ORDERED', 'CANCELLED'],
  ORDERED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
}

export default function VendorPurchaseOrdersPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    supplierId: '',
    expectedArrivalDate: '',
    notes: '',
    items: [{ productId: '', quantity: 1, unitCost: 0 }] as Array<{ productId: string; quantity: number; unitCost: number }>,
  })
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  useEffect(() => {
    fetchPurchaseOrders()
    fetchSuppliers()
    fetchProducts()
  }, [])

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vendor/purchase-orders')
      if (response.ok) {
        const data = await response.json()
        setPurchaseOrders(data.purchaseOrders || [])
      } else {
        setError('Failed to fetch purchase orders')
      }
    } catch (err) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/vendor/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers?.map((s: any) => ({ id: s.id, companyName: s.companyName })) || [])
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err)
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
    try {
      const response = await fetch(`/api/vendor/purchase-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        await fetchPurchaseOrders()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update purchase order')
      }
    } catch (err) {
      alert('Failed to update purchase order')
    }
  }

  const handleCreatePO = async () => {
    if (!formData.supplierId || formData.items.length === 0) {
      alert('Supplier and at least one item are required')
      return
    }

    const validItems = formData.items.filter(i => i.productId && i.quantity > 0 && i.unitCost >= 0)
    if (validItems.length === 0) {
      alert('At least one valid item is required')
      return
    }

    try {
      const response = await fetch('/api/vendor/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: validItems,
          expectedArrivalDate: formData.expectedArrivalDate || undefined,
        }),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setFormData({
          supplierId: '',
          expectedArrivalDate: '',
          notes: '',
          items: [{ productId: '', quantity: 1, unitCost: 0 }],
        })
        await fetchPurchaseOrders()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create purchase order')
      }
    } catch (err) {
      alert('Failed to create purchase order')
    }
  }

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', quantity: 1, unitCost: 0 }],
    })
  }

  const removeItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    })
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData({ ...formData, items: newItems })
  }

  if (loading && purchaseOrders.length === 0) {
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
        <div className="mb-6">
          <Link
            href="/dashboard/vendor"
            className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
              <p className="text-gray-600 mt-1">Create and manage purchase orders with suppliers</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              + Create Purchase Order
            </Button>
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Create Purchase Order</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Supplier *</label>
                    <select
                      value={formData.supplierId}
                      onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                    >
                      <option value="">Select a supplier</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.companyName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Expected Arrival Date</label>
                    <input
                      type="date"
                      value={formData.expectedArrivalDate}
                      onChange={e => setFormData({ ...formData, expectedArrivalDate: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={e => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full mt-1 rounded-lg border border-slate-200 p-2"
                      placeholder="Additional notes"
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Items</h4>
                      <Button size="sm" onClick={addItem}>Add Item</Button>
                    </div>
                    {formData.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 mb-3">
                        <select
                          value={item.productId}
                          onChange={e => updateItem(index, 'productId', e.target.value)}
                          className="col-span-5 rounded-lg border border-slate-200 p-2"
                        >
                          <option value="">Select product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          min="1"
                          className="col-span-2 rounded-lg border border-slate-200 p-2"
                          placeholder="Qty"
                        />
                        <input
                          type="number"
                          value={item.unitCost}
                          onChange={e => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                          className="col-span-3 rounded-lg border border-slate-200 p-2"
                          placeholder="Unit Cost"
                        />
                        <span className="col-span-2 text-right self-center text-sm font-medium">
                          {(item.quantity * item.unitCost).toFixed(2)}
                        </span>
                        {formData.items.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="col-span-2 text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePO} className="flex-1">
                    Create Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedPO && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Purchase Order Details</h3>
                <div className="space-y-3 text-sm">
                  <p><span className="font-medium">PO Number:</span> {selectedPO.poNumber}</p>
                  <p><span className="font-medium">Supplier:</span> {selectedPO.supplierName}</p>
                  <p><span className="font-medium">Status:</span> {selectedPO.status}</p>
                  <p><span className="font-medium">Total Cost:</span> {formatPrice(selectedPO.totalCost)}</p>
                  {selectedPO.expectedArrivalDate && (
                    <p><span className="font-medium">Expected Arrival:</span> {selectedPO.expectedArrivalDate}</p>
                  )}
                  {selectedPO.items && (
                    <div className="mt-3">
                      <p className="font-medium mb-2">Items:</p>
                      <div className="space-y-2">
                        {selectedPO.items.map(item => (
                          <div key={item.id} className="pl-3 border-l-2 border-gray-200">
                            <p>{item.product?.name} - {item.quantity} x {formatPrice(item.unitCost)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-6">
                  <Button variant="outline" onClick={() => setSelectedPO(null)} className="flex-1">
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {purchaseOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No purchase orders</h3>
              <p className="text-gray-600 mb-4">Create your first purchase order to manage procurement.</p>
              <Button onClick={() => setShowCreateModal(true)}>Create Purchase Order</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {purchaseOrders.map((po) => {
              const statusConfig = PO_STATUS_CONFIG[po.status] || PO_STATUS_CONFIG.DRAFT
              const nextStatuses = PO_TRANSITIONS[po.status] || []

              return (
                <Card key={po.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                          {po.isOverdue && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              Overdue
                            </span>
                          )}
                          {po.isLinked && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              Linked
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900">{po.poNumber}</p>
                        <p className="text-sm text-gray-600">Supplier: {po.supplierName}</p>
                        <p className="text-sm text-gray-600">Total: {formatPrice(po.totalCost)}</p>
                        {po.expectedArrivalDate && (
                          <p className={`text-xs mt-1 ${po.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                            Expected Arrival: {po.expectedArrivalDate}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(po.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedPO(po)}>
                          Details
                        </Button>
                        {nextStatuses.map(status => (
                          <button
                            key={status}
                            onClick={() => handleStatusUpdate(po.id, status)}
                            className="px-3 py-1 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700"
                          >
                            {status}
                          </button>
                        ))}
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