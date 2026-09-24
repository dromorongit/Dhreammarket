'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

interface Influencer {
  id: string
  name: string
  email: string | null
  phone: string | null
  referralCode: string
  active: boolean
  incentivePerVendor: number | null
  incentivePerCustomer: number | null
  createdAt: string
  linkClicks: number
  customerRegistrations: number
  vendorRegistrations: number
  approvedVendors: number
  eligibleIncentive: number
  amountPaid: number
  amountPending: number
}

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    incentivePerVendor: '',
    incentivePerCustomer: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchInfluencers()
  }, [])

  const fetchInfluencers = async () => {
    try {
      const response = await fetch('/api/super-admin/influencers')
      if (response.ok) {
        const data = await response.json()
        setInfluencers(data.influencers || [])
      }
    } catch (error) {
      console.error('Error fetching influencers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/super-admin/influencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          incentivePerVendor: formData.incentivePerVendor
            ? parseFloat(formData.incentivePerVendor)
            : null,
          incentivePerCustomer: formData.incentivePerCustomer
            ? parseFloat(formData.incentivePerCustomer)
            : null,
        }),
      })
      if (response.ok) {
        fetchInfluencers()
        resetForm()
      }
    } catch (error) {
      console.error('Error creating influencer:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (influencer: Influencer) => {
    try {
      const response = await fetch(`/api/super-admin/influencers/${influencer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !influencer.active }),
      })
      if (response.ok) {
        fetchInfluencers()
      }
    } catch (error) {
      console.error('Error toggling influencer status:', error)
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setFormData({ name: '', email: '', phone: '', incentivePerVendor: '', incentivePerCustomer: '' })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

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
                <a href="/dashboard/super-admin" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Super Admin Dashboard
                </a>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
                Influencers
              </h1>
              <p className="text-slate-300 text-sm sm:text-base">
                Manage influencer referral program
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
              {showForm ? 'Close Form' : 'Create Influencer'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        {showForm && (
          <Card variant="elevated" className="mb-6 overflow-hidden">
            <div className="bg-gradient-to-r from-royal-blue/5 to-purple-500/5 px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-deep-navy">Create New Influencer</h2>
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
                      placeholder="e.g. Anabel Selby"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm min-h-[44px]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. anabel@example.com"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm min-h-[44px]"
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Incentive per Vendor (GHS)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.incentivePerVendor}
                      onChange={(e) => setFormData({ ...formData, incentivePerVendor: e.target.value })}
                      placeholder="e.g. 50.00"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Incentive per Customer (GHS)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.incentivePerCustomer}
                      onChange={(e) => setFormData({ ...formData, incentivePerCustomer: e.target.value })}
                      placeholder="e.g. 10.00"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-royal-blue/20 focus:border-royal-blue transition-all text-sm min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="min-h-[44px]" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Influencer'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} className="min-h-[44px]">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {influencers.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-gray-500 mb-4">No influencers found</p>
                <Button onClick={() => { setShowForm(true) }}>Create First Influencer</Button>
              </CardContent>
            </Card>
          ) : (
            influencers.map((influencer) => (
              <Card key={influencer.id} variant="elevated" className="overflow-hidden">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-deep-navy text-lg">{influencer.name}</h3>
                        <Badge variant={influencer.active ? 'success' : 'danger'}>
                          {influencer.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mb-1">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{influencer.referralCode}</span>
                        <button
                          onClick={() => copyToClipboard(`${window.location.origin}/api/influencer/${influencer.referralCode}`)}
                          className="text-xs text-royal-blue hover:underline"
                        >
                          Copy tracked link
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span>Clicks: <strong className="text-slate-700">{influencer.linkClicks}</strong></span>
                        <span>Customers: <strong className="text-slate-700">{influencer.customerRegistrations}</strong></span>
                        <span>Vendors: <strong className="text-slate-700">{influencer.vendorRegistrations}</strong></span>
                        <span>Approved vendors: <strong className="text-slate-700">{influencer.approvedVendors}</strong></span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                        <span>Eligible incentive: <strong className="text-slate-700">{influencer.eligibleIncentive.toFixed(2)} GHS</strong></span>
                        <span>Paid: <strong className="text-slate-700">{influencer.amountPaid.toFixed(2)} GHS</strong></span>
                        <span>Pending: <strong className="text-slate-700">{influencer.amountPending.toFixed(2)} GHS</strong></span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                        {influencer.email && <span>{influencer.email}</span>}
                        {influencer.phone && <span>{influencer.phone}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/super-admin/influencers/${influencer.id}`}>
                        <Button size="sm" className="min-h-[44px]">
                          View Report
                        </Button>
                      </Link>
                      <Button
                        variant={influencer.active ? 'danger' : 'success'}
                        size="sm"
                        onClick={() => handleToggleActive(influencer)}
                        className="min-h-[44px]"
                      >
                        {influencer.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
