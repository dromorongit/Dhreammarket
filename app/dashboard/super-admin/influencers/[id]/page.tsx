'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'

interface Report {
  influencer: {
    id: string
    name: string
    email: string | null
    phone: string | null
    referralCode: string
    active: boolean
    incentivePerVendor: number | null
    incentivePerCustomer: number | null
    createdAt: string
    updatedAt: string
  }
  linkClicks: number
  customerRegistrations: number
  vendorRegistrations: number
  approvedVendors: number
  orders: number
  completedOrders: number
  cancelledRefundedOrders: number
  eligibleIncentive: number
  amountPaid: number
  amountPending: number
}

interface Referral {
  id: string
  refereeEmail: string
  refereeName: string
  refereeRole: string
  codeUsed: string
  qualified: boolean
  qualifiedAt: string | null
  incentiveAmount: number | null
  incentivePaid: boolean
  incentivePaidAt: string | null
  createdAt: string
}

export default function InfluencerDetailPage({ params }: { params: { id: string } }) {
  const [report, setReport] = useState<Report | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [referralsLoading, setReferralsLoading] = useState(true)
  const [editingRates, setEditingRates] = useState(false)
  const [rateForm, setRateForm] = useState({
    incentivePerVendor: '',
    incentivePerCustomer: '',
  })
  const [savingRates, setSavingRates] = useState(false)

  useEffect(() => {
    fetchReport()
    fetchReferrals()
  }, [params.id])

  const fetchReport = async () => {
    try {
      const response = await fetch(`/api/super-admin/influencers/${params.id}/report`)
      if (response.ok) {
        const data = await response.json()
        setReport(data.report)
        setRateForm({
          incentivePerVendor: data.report.influencer.incentivePerVendor ?? '',
          incentivePerCustomer: data.report.influencer.incentivePerCustomer ?? '',
        })
      }
    } catch (error) {
      console.error('Error fetching report:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchReferrals = async () => {
    try {
      const response = await fetch(`/api/super-admin/influencers/${params.id}/referrals`)
      if (response.ok) {
        const data = await response.json()
        setReferrals(data.referrals || [])
      }
    } catch (error) {
      console.error('Error fetching referrals:', error)
    } finally {
      setReferralsLoading(false)
    }
  }

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingRates(true)
    try {
      const response = await fetch(`/api/super-admin/influencers/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incentivePerVendor: rateForm.incentivePerVendor ? parseFloat(rateForm.incentivePerVendor) : null,
          incentivePerCustomer: rateForm.incentivePerCustomer ? parseFloat(rateForm.incentivePerCustomer) : null,
        }),
      })
      if (response.ok) {
        setEditingRates(false)
        fetchReport()
      }
    } catch (error) {
      console.error('Error saving rates:', error)
    } finally {
      setSavingRates(false)
    }
  }

  const handleMarkPaid = async (referralId: string) => {
    try {
      const response = await fetch(`/api/super-admin/influencer-referrals/${referralId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      if (response.ok) {
        fetchReferrals()
        fetchReport()
      }
    } catch (error) {
      console.error('Error marking referral as paid:', error)
    }
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

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-500">Influencer not found</p>
          <Link href="/dashboard/super-admin/influencers">
            <Button className="mt-4">Back to Influencers</Button>
          </Link>
        </div>
      </div>
    )
  }

  const trackableLink = `${window.location.origin}/api/influencer/${report.influencer.referralCode}`

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-deep-navy via-purple-900 to-royal-blue py-12 lg:py-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-80 h-80 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-80 h-80 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link href="/dashboard/super-admin/influencers" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Influencers
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">
                {report.influencer.name}
              </h1>
              <p className="text-slate-300 text-sm sm:text-base">
                Influencer dashboard and referral report
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant={report.influencer.active ? 'success' : 'danger'}>
                {report.influencer.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        <Card variant="elevated" className="mb-6 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-royal-blue/5 to-purple-500/5 px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-deep-navy">Trackable Link</h2>
              <div className="flex gap-2">
                <code className="text-xs bg-slate-100 px-3 py-1.5 rounded font-mono break-all">{trackableLink}</code>
                <Button size="sm" onClick={() => copyToClipboard(trackableLink)} className="min-h-[44px]">
                  Copy
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">Link Clicks</p>
                <p className="text-xl font-bold text-deep-navy">{report.linkClicks}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Customer Registrations</p>
                <p className="text-xl font-bold text-deep-navy">{report.customerRegistrations}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Vendor Registrations</p>
                <p className="text-xl font-bold text-deep-navy">{report.vendorRegistrations}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Approved Vendors</p>
                <p className="text-xl font-bold text-deep-navy">{report.approvedVendors}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card variant="elevated">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Orders</p>
              <p className="text-xl font-bold text-deep-navy">{report.orders}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Completed Orders</p>
              <p className="text-xl font-bold text-deep-navy">{report.completedOrders}</p>
            </CardContent>
          </Card>
          <Card variant="elevated">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">Cancelled / Refunded</p>
              <p className="text-xl font-bold text-deep-navy">{report.cancelledRefundedOrders}</p>
            </CardContent>
          </Card>
        </div>

        <Card variant="elevated" className="mb-6 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-royal-blue/5 to-purple-500/5 px-6 py-4 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-deep-navy">Incentive Rates</h2>
              {!editingRates ? (
                <Button size="sm" onClick={() => setEditingRates(true)} className="min-h-[44px]">
                  Edit Rates
                </Button>
              ) : (
                <form onSubmit={handleSaveRates} className="flex gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Per Vendor (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rateForm.incentivePerVendor}
                      onChange={(e) => setRateForm({ ...rateForm, incentivePerVendor: e.target.value })}
                      className="w-32 px-2 py-1.5 border border-slate-200 rounded-lg text-sm min-h-[36px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500">Per Customer (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={rateForm.incentivePerCustomer}
                      onChange={(e) => setRateForm({ ...rateForm, incentivePerCustomer: e.target.value })}
                      className="w-32 px-2 py-1.5 border border-slate-200 rounded-lg text-sm min-h-[36px]"
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={savingRates} className="min-h-[44px]">
                    {savingRates ? 'Saving...' : 'Save'}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingRates(false)} className="min-h-[44px]">
                    Cancel
                  </Button>
                </form>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-500">Eligible Incentive</p>
                <p className="text-xl font-bold text-deep-navy">{formatCurrency(report.eligibleIncentive)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount Paid</p>
                <p className="text-xl font-bold text-deep-navy">{formatCurrency(report.amountPaid)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount Pending</p>
                <p className="text-xl font-bold text-deep-navy">{formatCurrency(report.amountPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="elevated" className="overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-deep-navy">Referrals</h2>
          </CardHeader>
          <CardContent className="p-0">
            {referralsLoading ? (
              <p className="text-sm text-gray-500 p-6">Loading referrals...</p>
            ) : referrals.length === 0 ? (
              <p className="text-sm text-gray-500 p-6">No referrals yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Referee</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Role</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Code Used</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Qualified</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Incentive</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Paid</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Created</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="border-b border-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{referral.refereeName}</div>
                          <div className="text-xs text-gray-500">{referral.refereeEmail}</div>
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={referral.refereeRole === 'VENDOR' ? 'info' : 'default'}>
                            {referral.refereeRole}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">{referral.codeUsed}</td>
                        <td className="py-2 px-3">
                          <Badge variant={referral.qualified ? 'success' : 'warning'}>
                            {referral.qualified ? 'Yes' : 'No'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{formatCurrency(referral.incentiveAmount ?? 0)}</td>
                        <td className="py-2 px-3">
                          <Badge variant={referral.incentivePaid ? 'success' : 'warning'}>
                            {referral.incentivePaid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-gray-500">
                          {new Date(referral.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {referral.qualified && !referral.incentivePaid && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkPaid(referral.id)}
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
