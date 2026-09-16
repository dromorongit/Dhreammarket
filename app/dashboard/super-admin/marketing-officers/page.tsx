'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
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
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredOfficers = useMemo(() => {
    if (!searchQuery.trim()) return officers
    const q = searchQuery.toLowerCase()
    return officers.filter((o) => o.name.toLowerCase().includes(q))
  }, [officers, searchQuery])

  const totalReferrals = useMemo(() => officers.reduce((sum, o) => sum + o.referralCount, 0), [officers])
  const totalUnpaid = useMemo(() => officers.reduce((sum, o) => sum + o.totalUnpaid, 0), [officers])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy via-purple-900 to-royal-blue py-12 lg:py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="mb-3">
                <Link href="/dashboard/super-admin" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Super Admin Dashboard
                </Link>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
                Marketing Officers
              </h1>
              <p className="text-slate-300 text-sm sm:text-base">
                Manage marketing officers and track referral payouts
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowForm(!showForm)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm min-h-[44px]"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showForm ? 'Close Form' : 'Create Officer'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Officers</p>
                  <p className="text-xl font-bold text-deep-navy">{officers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Referrals</p>
                  <p className="text-xl font-bold text-deep-navy">{totalReferrals}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.105 0 2-.895 2-2S13.105 2 12 2s-2 .895-2 2-.895 2-2 2m0 0v4m0-4v4m0-4v4" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Unpaid</p>
                  <p className="text-xl font-bold text-deep-navy">{formatCurrency(totalUnpaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Active Officers</p>
                  <p className="text-xl font-bold text-deep-navy">{officers.filter((o) => o.active).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Create */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search officers by name..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-royal-blue outline-none text-sm min-h-[44px]"
          />
          <Button
            onClick={() => setShowForm(!showForm)}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {showForm ? 'Close Form' : 'Create Officer'}
          </Button>
        </div>

        {/* Create Officer Form */}
        {showForm && (
          <Card variant="elevated" className="mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-royal-blue/5 to-purple-500/5 px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-deep-navy">Create New Officer</h2>
            </div>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. John Doe"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm min-h-[44px]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +233 24 000 0000"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm min-h-[44px]"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. john@example.com"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="min-h-[44px]">Create Officer</Button>
                  <Button type="button" variant="outline" onClick={resetForm} className="min-h-[44px]">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Officers List */}
        <div className="space-y-4">
          {filteredOfficers.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-gray-500 mb-4">No marketing officers found</p>
                <Button onClick={() => { setShowForm(true); setSearchQuery('') }}>Create First Officer</Button>
              </CardContent>
            </Card>
          ) : (
            filteredOfficers.map((officer) => (
              <Card key={officer.id} variant="elevated" className="overflow-hidden">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-deep-navy text-lg">{officer.name}</h3>
                        <Badge variant={officer.active ? 'success' : 'danger'}>
                          {officer.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-1">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{officer.referralCode}</span>
                        <span>Referrals: <strong className="text-slate-700">{officer.referralCount}</strong></span>
                        <span>Total Unpaid: <strong className="text-slate-700">{formatCurrency(officer.totalUnpaid)}</strong></span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        {officer.email && <span>{officer.email}</span>}
                        {officer.phone && <span>{officer.phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleExpand(officer.id)}
                        className="min-h-[44px]"
                      >
                        {expandedId === officer.id ? 'Hide Referrals' : 'View Referrals'}
                      </Button>
                      <Button
                        variant={officer.active ? 'danger' : 'success'}
                        size="sm"
                        onClick={() => handleToggleActive(officer)}
                        className="min-h-[44px]"
                      >
                        {officer.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </div>

                {expandedId === officer.id && (
                  <div className="border-t border-gray-100">
                    <div className="p-4 sm:p-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4">Referrals</h4>
                      {referralsLoading[officer.id] ? (
                        <p className="text-sm text-gray-500">Loading referrals...</p>
                      ) : referrals[officer.id]?.length === 0 ? (
                        <EmptyState
                          icon={
                            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          }
                          title="No referrals yet"
                          description="This officer has no referrals assigned."
                          className="py-6"
                        />
                      ) : (
                        <>
                          {/* Desktop Table */}
                          <div className="hidden md:block overflow-x-auto">
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
                                          className="min-h-[44px]"
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

                          {/* Mobile Stacked Cards */}
                          <div className="md:hidden space-y-3">
                            {referrals[officer.id]?.map((referral) => (
                              <div
                                key={referral.id}
                                className="bg-slate-50 rounded-xl p-4 border border-slate-100"
                              >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-900 truncate">{referral.vendor.email}</p>
                                    {referral.vendor.store?.name && (
                                      <p className="text-xs text-slate-500 truncate">{referral.vendor.store.name}</p>
                                    )}
                                    <p className="text-xs text-slate-400 font-mono mt-1">{referral.codeUsed}</p>
                                  </div>
                                  <Badge variant={referral.paid ? 'success' : 'warning'} className="flex-shrink-0">
                                    {referral.paid ? 'Paid' : 'Unpaid'}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                  <div>
                                    <p className="text-xs text-slate-500">Amount Owed</p>
                                    <p className="font-medium text-slate-900">{formatCurrency(referral.amountOwed)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">Paid At</p>
                                    <p className="font-medium text-slate-900">
                                      {referral.paidAt ? new Date(referral.paidAt).toLocaleDateString() : '-'}
                                    </p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-xs text-slate-500">Created</p>
                                    <p className="font-medium text-slate-900">
                                      {new Date(referral.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                {!referral.paid && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkPaid(referral.id, officer.id)}
                                    className="w-full min-h-[44px]"
                                  >
                                    Mark as Paid
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}