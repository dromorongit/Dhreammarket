'use client'

'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatPrice } from '@/lib/currency'

interface FlashDeal {
  id: string
  title: string
  description?: string
  discountType: string
  discountValue: number
  maxDiscount?: number
  startDate: string
  endDate: string
  isActive: boolean
  products: {
    id: string
    dealPrice: number
    product?: { id: string; name: string; price: number; images: { url: string }[] }
    service?: { id: string; title: string; startingPrice: number; images: { url: string }[] }
  }[]
}

export default function AdminFlashDealsPage() {
  const [deals, setDeals] = useState<FlashDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 0,
    maxDiscount: '',
    startDate: '',
    endDate: '',
    vendorId: '',
    productIds: '',
  })

  useEffect(() => {
    fetchDeals()
  }, [])

  const fetchDeals = async () => {
    try {
      const response = await fetch('/api/flash-deals')
      if (response.ok) {
        const data = await response.json()
        setDeals(data.deals || [])
      }
    } catch (error) {
      console.error('Error fetching flash deals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/flash-deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          discountValue: parseFloat(formData.discountValue.toString()),
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : undefined,
          productIds: formData.productIds ? formData.productIds.split(',').map((id) => id.trim()) : [],
        }),
      })
      if (response.ok) {
        fetchDeals()
        resetForm()
      }
    } catch (error) {
      console.error('Error creating flash deal:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flash deal?')) return
    try {
      const response = await fetch(`/api/flash-deals/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchDeals()
      }
    } catch (error) {
      console.error('Error deleting flash deal:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setFormData({
      title: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 0,
      maxDiscount: '',
      startDate: '',
      endDate: '',
      vendorId: '',
      productIds: '',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-32"></div>
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
            <h1 className="text-3xl font-bold text-deep-navy">Flash Deals</h1>
            <p className="text-gray-500 mt-1">Manage flash deals and limited-time offers</p>
          </div>
          <Button onClick={() => setShowForm(true)}>Create Flash Deal</Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <h3 className="font-semibold text-deep-navy">Create Flash Deal</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    >
                      <option value="PERCENTAGE">Percentage</option>
                      <option value="FIXED_AMOUNT">Fixed Amount</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
                    <input
                      type="number"
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                      min="0"
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
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product IDs (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.productIds}
                    onChange={(e) => setFormData({ ...formData, productIds: e.target.value })}
                    placeholder="prod_123, prod_456"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit">Create Flash Deal</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {deals.map((deal) => (
            <Card key={deal.id} variant="elevated">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-deep-navy">{deal.title}</h3>
                    <Badge variant={deal.isActive ? 'success' : 'danger'}>
                      {deal.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge>{deal.discountType}</Badge>
                  </div>
                  {deal.description && <p className="text-sm text-gray-600 mb-2">{deal.description}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span>Discount: <strong>{deal.discountValue}{deal.discountType === 'PERCENTAGE' ? '%' : ` ${deal.discountValue}`}</strong></span>
                    {deal.maxDiscount && <span>Max: {deal.maxDiscount}</span>}
                    <span>Starts: {new Date(deal.startDate).toLocaleString()}</span>
                    <span>Ends: {new Date(deal.endDate).toLocaleString()}</span>
                    <span>{deal.products.length} products</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="danger" size="sm" onClick={() => handleDelete(deal.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {deals.length === 0 && !showForm && (
          <Card className="text-center py-12">
            <p className="text-gray-500 mb-4">No flash deals created yet</p>
            <Button onClick={() => setShowForm(true)}>Create First Flash Deal</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
