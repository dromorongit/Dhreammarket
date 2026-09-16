'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'

interface Officer {
  id: string
  name: string
  phone: string | null
  email: string | null
  referralCode: string
  active: boolean
  createdAt: string
  referralCount: number
  totalUnpaid: number
}

interface Referral {
  id: string
  vendorUserId: string
  codeUsed: string
  amountOwed: number
  paid: boolean
  paidAt: string | null
  createdAt: string
  vendor: {
    id: string
    email: string
    store: { id: string; name: string } | null
  }
}

export default function MarketingOfficersPage() {
  const [officers, setOfficers] = useState<Officer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [referrals, setReferrals] = useState<Record<string, Referral[]>>({})
  const [referralsLoading, setReferralsLoading] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  })

  useEffect(() => {
    fetchOfficers()
  }, [])

  const fetchOfficers = async () => {
    try {
      const response = await fetch('/api/super-admin/marketing-officers')
      if (response.ok) {
        const data = await response.json()
        setOfficers(data.officers || [])
      }
    } catch (error) {
      console.error('Error fetching marketing officers:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReferrals = async (officerId: string) => {
    setReferralsLoading((prev) => ({ ...prev, [officerId]: true }))
    try {
      const response = await fetch(`/api/super-admin/marketing-officers/${officerId}/referrals`)
      if (response.ok) {
        const data = await response.json()
        setReferrals((prev) => ({ ...prev, [officerId]: data.referrals || [] }))
      }
    } catch (error) {
      console.error('Error fetching referrals:', error)
    } finally {
      setReferralsLoading((prev) => ({ ...prev, [officerId]: false }))
    }
  }

  const handleToggleExpand = async (officerId: string) => {
    if (expandedId === officerId) {
      setExpandedId(null)
      return
    }
    setExpandedId(officerId)
    if (!referrals[officerId]) {
      await fetchReferrals(officerId)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/super-admin/marketing-officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        fetchOfficers()
        resetForm()
      }
    } catch (error) {
      console.error('Error creating officer:', error)
    }
  }

  const handleToggleActive = async (officer: Officer) => {
    try {
      const response = await fetch(`/api/super-admin/marketing-officers/${officer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !officer.active }),
      })
      if (response.ok) {
        fetchOfficers()
      }
    } catch (error) {
      console.error('Error toggling officer status:', error)
    }
  }

  const handleMarkPaid = async (referralId: string, officerId: string) => {
    try {
      const response = await fetch(`/api/super-admin/vendor-referrals/${referralId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        await fetchReferrals(officerId)
        fetchOfficers()
      }
    } catch (error) {
      console.error('Error marking referral as paid:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setFormData({ name: '', phone: '', email: '' })
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
            <h1 className="text-3xl font-bold text-deep-navy">Marketing Officers</h1>
            <p className="text-gray-500 mt-1">Manage marketing officers and view referral payouts</p>
          </div>
          <Button onClick={() => setShowForm(true)}>Create Officer</Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <h3 className="font-semibold text-deep-navy">Create Officer</h3>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-royal-blue focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button type="submit">Create Officer</Button>
                  <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {officers.map((officer) => (
            <Card key={officer.id} variant="elevated">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-deep-navy">{officer.name}</h3>
                    <Badge variant={officer.active ? 'success' : 'danger'}>
                      {officer.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-sm text-gray-500 font-mono">{officer.referralCode}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span>Referrals: <strong>{officer.referralCount}</strong></span>
                    <span>Total Unpaid: <strong>{formatCurrency(officer.totalUnpaid)}</strong></span>
                    {officer.email && <span>Email: {officer.email}</span>}
                    {officer.phone && <span>Phone: {officer.phone}</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleExpand(officer.id)}
                  >
                    {expandedId === officer.id ? 'Hide Referrals' : 'View Referrals'}
                  </Button>
                  <Button
                    variant={officer.active ? 'danger' : 'success'}
                    size="sm"
                    onClick={() => handleToggleActive(officer)}
                  >
                    {officer.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </div>
              {expandedId === officer.id && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Referrals</h4>
                  {referralsLoading[officer.id] ? (
                    <p className="text-sm text-gray-500">Loading referrals...</p>
                  ) : referrals[officer.id]?.length === 0 ? (
                    <p className="text-sm text-gray-500">No referrals yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Vendor</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Code Used</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Amount Owed</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Paid At</th>
                            <th className="text-left py-2 px-3 font-medium text-gray-600">Created</th>
                            <th className="text-right py-2 px-3 font-medium text-gray-600">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referrals[officer.id]?.map((referral) => (
                            <tr key={referral.id} className="border-b border-gray-50">
                              <td className="py-2 px-3">
                                <div className="font-medium text-gray-900">{referral.vendor.email}</div>
                                {referral.vendor.store?.name && (
                                  <div className="text-xs text-gray-500">{referral.vendor.store.name}</div>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono text-xs">{referral.codeUsed}</td>
                              <td className="py-2 px-3">{formatCurrency(referral.amountOwed)}</td>
                              <td className="py-2 px-3">
                                <Badge variant={referral.paid ? 'success' : 'warning'}>
                                  {referral.paid ? 'Paid' : 'Unpaid'}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-gray-500">
                                {referral.paidAt ? new Date(referral.paidAt).toLocaleDateString() : '-'}
                              </td>
                              <td className="py-2 px-3 text-gray-500">
                                {new Date(referral.createdAt).toLocaleDateString()}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {!referral.paid && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkPaid(referral.id, officer.id)}
                                  >
                                    Mark as Paid
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>

        {officers.length === 0 && !showForm && (
          <Card className="text-center py-12">
            <p className="text-gray-500 mb-4">No marketing officers created yet</p>
            <Button onClick={() => setShowForm(true)}>Create First Officer</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
