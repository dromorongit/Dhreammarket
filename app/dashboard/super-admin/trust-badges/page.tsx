'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { StarRating } from '@/components/StarRating'

interface TrustBadge {
  id: string
  vendorId: string
  badgeType: string
  awardedAt: string
  expiresAt?: string
  isActive: boolean
  store: {
    id: string
    name: string
    slug: string
    averageRating: number
    reviewCount: number
  }
}

export default function AdminTrustBadgesPage() {
  const [badges, setBadges] = useState<TrustBadge[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    vendorId: '',
    badgeType: 'TOP_SELLER',
    expiresAt: '',
  })

  useEffect(() => {
    fetchBadges()
    fetchVendors()
  }, [])

  const fetchBadges = async () => {
    try {
      const response = await fetch('/api/admin/trust-badges')
      if (response.ok) {
        const data = await response.json()
        setBadges(data.badges || [])
      }
    } catch (error) {
      console.error('Error fetching trust badges:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/admin/vendors')
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
      }
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/trust-badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          expiresAt: formData.expiresAt || undefined,
        }),
      })
      if (response.ok) {
        fetchBadges()
        resetForm()
      }
    } catch (error) {
      console.error('Error awarding badge:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this badge?')) return
    try {
      const response = await fetch(`/api/admin/trust-badges/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchBadges()
      }
    } catch (error) {
      console.error('Error revoking badge:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setFormData({
      vendorId: '',
      badgeType: 'TOP_SELLER',
      expiresAt: '',
    })
  }

  const getBadgeVariant = (badgeType: string) => {
    switch (badgeType) {
      case 'TOP_SELLER':
      case 'TOP_SERVICE_PROVIDER':
        return 'premium'
      case 'TRUSTED_VENDOR':
        return 'trusted-vendor'
      case 'PREMIUM_VENDOR':
        return 'premium-vendor'
      case 'PLATINUM_VENDOR':
        return 'platinum-vendor'
      case 'HIGHLY_RATED':
        return 'verified'
      case 'VERIFIED_BUSINESS':
        return 'info'
      case 'FAST_RESPONDER':
        return 'success'
      default:
        return 'default'
    }
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
            <h1 className="text-3xl font-bold text-deep-navy">Trust Badges</h1>
            <p className="text-gray-500 mt-1">Award and manage trust badges for vendors</p>
          </div>
          <Button onClick={() => setShowForm(true)}>Award Badge</Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <h3 className="font-semibold text-deep-navy">Award Trust Badge</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                    <select
                      value={formData.vendorId}
                      onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                    >
                      <option value="">Select a vendor</option>
                      {vendors.map((vendor: any) => (
                        <option key={vendor.id} value={vendor.userId || vendor.id}>
                          {vendor.name || vendor.store?.name || vendor.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Badge Type</label>
                    <select
                      value={formData.badgeType}
                      onChange={(e) => setFormData({ ...formData, badgeType: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    >
                      <option value="TOP_SELLER">Top Seller</option>
                      <option value="TOP_SERVICE_PROVIDER">Top Service Provider</option>
                      <option value="FAST_RESPONDER">Fast Responder</option>
                      <option value="TRUSTED_VENDOR">Trusted Vendor</option>
                      <option value="PREMIUM_VENDOR">Premium Vendor</option>
                      <option value="PLATINUM_VENDOR">Platinum Vendor</option>
                      <option value="HIGHLY_RATED">Highly Rated</option>
                      <option value="VERIFIED_BUSINESS">Verified Business</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expires At (optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit">Award Badge</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {badges.map((badge) => (
            <Card key={badge.id} variant="elevated">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={getBadgeVariant(badge.badgeType) as any}>
                      {badge.badgeType.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant={badge.isActive ? 'success' : 'danger'}>
                      {badge.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="font-medium text-deep-navy">{badge.store.name}</span>
                    <div className="flex items-center gap-1">
                      <StarRating rating={badge.store.averageRating || 0} size="sm" />
                      <span>({badge.store.reviewCount || 0})</span>
                    </div>
                    <span>Awarded: {new Date(badge.awardedAt).toLocaleDateString()}</span>
                    {badge.expiresAt && <span>Expires: {new Date(badge.expiresAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button variant="danger" size="sm" onClick={() => handleDelete(badge.id)}>Revoke</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {badges.length === 0 && !showForm && (
          <Card className="text-center py-12">
            <p className="text-gray-500 mb-4">No trust badges awarded yet</p>
            <Button onClick={() => setShowForm(true)}>Award First Badge</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
