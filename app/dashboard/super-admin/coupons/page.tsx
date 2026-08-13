'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatPrice } from '@/lib/currency'

interface Coupon {
  id: string
  code: string
  type: string
  value: number
  currency: string
  minSpend?: number
  maxDiscount?: number
  usageLimit?: number
  usedCount: number
  perUserLimit: number
  startDate?: string
  expiryDate: string
  isActive: boolean
  description?: string
  createdAt: string
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    type: 'PERCENTAGE',
    value: 0,
    currency: 'GHS',
    minSpend: '',
    maxDiscount: '',
    usageLimit: '',
    perUserLimit: 1,
    startDate: '',
    expiryDate: '',
    isActive: true,
    description: '',
  })

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      const response = await fetch('/api/coupons')
      if (response.ok) {
        const data = await response.json()
        setCoupons(data.coupons || [])
      }
    } catch (error) {
      console.error('Error fetching coupons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = editingCoupon ? 'PUT' : 'POST'
      const url = editingCoupon ? `/api/coupons/${editingCoupon.id}` : '/api/coupons'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          minSpend: formData.minSpend ? parseFloat(formData.minSpend) : undefined,
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        }),
      })
      if (response.ok) {
        fetchCoupons()
        resetForm()
      }
    } catch (error) {
      console.error('Error saving coupon:', error)
    }
  }

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      currency: coupon.currency,
      minSpend: coupon.minSpend?.toString() || '',
      maxDiscount: coupon.maxDiscount?.toString() || '',
      usageLimit: coupon.usageLimit?.toString() || '',
      perUserLimit: coupon.perUserLimit,
      startDate: coupon.startDate || '',
      expiryDate: coupon.expiryDate,
      isActive: coupon.isActive,
      description: coupon.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return
    try {
      const response = await fetch(`/api/coupons/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchCoupons()
      }
    } catch (error) {
      console.error('Error deleting coupon:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingCoupon(null)
    setFormData({
      code: '',
      type: 'PERCENTAGE',
      value: 0,
      currency: 'GHS',
      minSpend: '',
      maxDiscount: '',
      usageLimit: '',
      perUserLimit: 1,
      startDate: '',
      expiryDate: '',
      isActive: true,
      description: '',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-24"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">Coupons & Promotions</h1>
            <p className="text-gray-500 mt-1">Manage coupons and promotional codes</p>
          </div>
          <Button onClick={() => setShowForm(true)}>Create Coupon</Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <h3 className="font-semibold text-deep-navy">{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                      disabled={!!editingCoupon}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED_AMOUNT">Fixed Amount</option>
                      <option value="FREE_DELIVERY">Free Delivery</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                    <input
                      type="number"
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    >
                      <option value="GHS">GHS</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Spend</label>
                    <input
                      type="number"
                      value={formData.minSpend}
                      onChange={(e) => setFormData({ ...formData, minSpend: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount</label>
                    <input
                      type="number"
                      value={formData.maxDiscount}
                      onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
                    <input
                      type="number"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Per User Limit</label>
                    <input
                      type="number"
                      value={formData.perUserLimit}
                      onChange={(e) => setFormData({ ...formData, perUserLimit: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input
                      type="datetime-local"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 text-royal-blue focus:ring-royal-blue border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <Button type="submit">{editingCoupon ? 'Update' : 'Create'} Coupon</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {coupons.map((coupon) => (
            <Card key={coupon.id} variant="elevated">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-deep-navy">{coupon.code}</h3>
                    <Badge variant={coupon.isActive ? 'success' : 'danger'}>
                      {coupon.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge>{coupon.type.replace('_', ' ')}</Badge>
                  </div>
                  {coupon.description && <p className="text-sm text-gray-600 mb-2">{coupon.description}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span>Value: <strong>{coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : `${coupon.currency} ${coupon.value}`}</strong></span>
                    {coupon.minSpend && <span>Min Spend: {coupon.currency} {coupon.minSpend}</span>}
                    {coupon.maxDiscount && <span>Max Discount: {coupon.currency} {coupon.maxDiscount}</span>}
                    <span>Usage: {coupon.usedCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}</span>
                    <span>Per User: {coupon.perUserLimit}</span>
                    <span>Expires: {new Date(coupon.expiryDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(coupon)}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(coupon.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {coupons.length === 0 && !showForm && (
          <Card className="text-center py-12">
            <p className="text-gray-500 mb-4">No coupons created yet</p>
            <Button onClick={() => setShowForm(true)}>Create First Coupon</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
