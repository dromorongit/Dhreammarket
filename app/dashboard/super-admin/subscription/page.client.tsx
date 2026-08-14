'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'

interface SubscriptionPlan {
  name: string
  priceMonthly: number | null
  priceYearly: number | null
  productsLimit: number
  servicesLimit: number
  isActive: boolean
  isFeatured: boolean
  displayOrder: number
  description: string | null
  benefits: string[]
}

interface RevenueData {
  monthlyRevenue: number
  yearlyRevenue: number
  totalRevenue: number
  activeSubscriptions: number
  planDistribution: Array<{
    planName: string
    count: number
    totalPaid: number
  }>
}

interface UpcomingRenewal {
  vendorId: string
  vendorName: string
  planName: string
  nextRenewalAt: string
}

interface ExpiredSubscription {
  vendorId: string
  vendorName: string
  planName: string
  expiredAt: string
}

export default function SuperAdminSubscriptionPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [upcomingRenewals, setUpcomingRenewals] = useState<UpcomingRenewal[]>([])
  const [expiredSubscriptions, setExpiredSubscriptions] = useState<ExpiredSubscription[]>([])
  const [distribution, setDistribution] = useState<Array<{ planName: string; count: number; totalPaid: number }>>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false)
  const [newPlan, setNewPlan] = useState({ name: '', priceMonthly: '', priceYearly: '', productsLimit: '20', servicesLimit: '10' })

  const fetchData = useCallback(async () => {
    try {
      const [plansRes, revenueRes, renewalsRes, expiredRes, distRes] = await Promise.all([
        fetch('/api/subscription/admin?action=plans'),
        fetch('/api/subscription/admin?action=revenue'),
        fetch('/api/subscription/admin?action=upcomingRenewals'),
        fetch('/api/subscription/admin?action=expired'),
        fetch('/api/subscription/admin?action=distribution'),
      ])

      if (plansRes.ok) { const d = await plansRes.json(); setPlans(d.plans ?? []) }
      if (revenueRes.ok) { const d = await revenueRes.json(); setRevenue(d.revenue ?? null) }
      if (renewalsRes.ok) { const d = await renewalsRes.json(); setUpcomingRenewals(d.renewals ?? []) }
      if (expiredRes.ok) { const d = await expiredRes.json(); setExpiredSubscriptions(d.expired ?? []) }
      if (distRes.ok) { const d = await distRes.json(); setDistribution(d.distribution ?? []) }
    } catch (err) {
      console.error('Error fetching subscription data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreatePlan = async () => {
    try {
      const res = await fetch('/api/subscription/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPlan',
          name: newPlan.name,
          priceMonthly: parseFloat(newPlan.priceMonthly) || null,
          priceYearly: parseFloat(newPlan.priceYearly) || null,
          productsLimit: parseInt(newPlan.productsLimit) || 20,
          servicesLimit: parseInt(newPlan.servicesLimit) || 10,
        }),
      })
      if (res.ok) {
        setShowCreatePlanModal(false)
        setNewPlan({ name: '', priceMonthly: '', priceYearly: '', productsLimit: '20', servicesLimit: '10' })
        fetchData()
      }
    } catch (err) {
      console.error('Error creating plan:', err)
    }
  }

  const handleTogglePlan = async (name: string) => {
    try {
      const res = await fetch('/api/subscription/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'togglePlan', name }),
      })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Error toggling plan:', err)
    }
  }

  const handleDeletePlan = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the "${name}" plan?`)) return
    try {
      const res = await fetch('/api/subscription/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deletePlan', name }),
      })
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      console.error('Error deleting plan:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading subscription management...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">Subscription Management</h1>

        <div className="flex gap-2 mb-8 border-b border-gray-200">
          {['overview', 'plans', 'renewals', 'expired'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-royal-blue text-royal-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Monthly Revenue</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-royal-blue">
                    {revenue ? formatCurrency(revenue.monthlyRevenue) : 'GH₵ 0.00'}
                  </p>
                  <p className="text-sm text-gray-500">This month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Annual Revenue</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-deep-navy">
                    {revenue ? formatCurrency(revenue.yearlyRevenue) : 'GH₵ 0.00'}
                  </p>
                  <p className="text-sm text-gray-500">This year</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Active Subscriptions</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-deep-navy">
                    {revenue?.activeSubscriptions ?? 0}
                  </p>
                  <p className="text-sm text-gray-500">Currently active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Total Revenue</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-royal-blue">
                    {revenue ? formatCurrency(revenue.totalRevenue) : 'GH₵ 0.00'}
                  </p>
                  <p className="text-sm text-gray-500">All time</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-deep-navy">Plan Distribution</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {distribution.map((d) => (
                    <div key={d.planName} className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-deep-navy">{d.planName}</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className="bg-royal-blue h-2 rounded-full"
                            style={{ width: `${revenue?.activeSubscriptions ? (d.count / revenue.activeSubscriptions) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">{d.count} vendors</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'plans' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-deep-navy">Subscription Plans</h2>
              <Button onClick={() => setShowCreatePlanModal(true)}>Create Plan</Button>
            </div>

            {showCreatePlanModal && (
              <Card className="mb-6">
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Create New Plan</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-deep-navy mb-1">Plan Name</label>
                      <input
                        type="text"
                        value={newPlan.name}
                        onChange={(e) => setNewPlan((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="e.g., Premium"
                      />
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm font-medium text-deep-navy mb-1">Monthly Price (GHS)</label>
                         <input
                           type="number"
                           value={newPlan.priceMonthly}
                           onChange={(e) => setNewPlan((prev) => ({ ...prev, priceMonthly: e.target.value }))}
                           className="w-full border rounded-lg px-3 py-2"
                           placeholder="0 for free"
                         />
                       </div>
                       <div>
                         <label className="block text-sm font-medium text-deep-navy mb-1">Yearly Price (GHS)</label>
                         <input
                           type="number"
                           value={newPlan.priceYearly}
                           onChange={(e) => setNewPlan((prev) => ({ ...prev, priceYearly: e.target.value }))}
                           className="w-full border rounded-lg px-3 py-2"
                           placeholder="0 for free"
                         />
                       </div>
                     </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-deep-navy mb-1">Products Limit</label>
                        <input
                          type="number"
                          value={newPlan.productsLimit}
                          onChange={(e) => setNewPlan((prev) => ({ ...prev, productsLimit: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2"
                          placeholder="20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-deep-navy mb-1">Services Limit</label>
                        <input
                          type="number"
                          value={newPlan.servicesLimit}
                          onChange={(e) => setNewPlan((prev) => ({ ...prev, servicesLimit: e.target.value }))}
                          className="w-full border rounded-lg px-3 py-2"
                          placeholder="10"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCreatePlan}>Create Plan</Button>
                      <Button variant="outline" onClick={() => setShowCreatePlanModal(false)}>Cancel</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {plans.map((plan) => (
                <Card key={plan.name}>
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-deep-navy">{plan.name}</h3>
                        <Badge variant={plan.isActive ? 'success' : 'secondary'} size="sm">
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {plan.priceMonthly === 0 || plan.priceMonthly === null ? 'Free' : `${formatCurrency(plan.priceMonthly)}/mo`}
                        {plan.priceYearly && plan.priceYearly > 0 && ` | ${formatCurrency(plan.priceYearly)}/yr`}
                      </p>
                      <p className="text-sm text-gray-500">
                        Products: {plan.productsLimit === -1 ? 'Unlimited' : plan.productsLimit} | Services: {plan.servicesLimit === -1 ? 'Unlimited' : plan.servicesLimit}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleTogglePlan(plan.name)}>
                        {plan.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeletePlan(plan.name)}>Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'renewals' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Upcoming Renewals</h2>
            {upcomingRenewals.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No upcoming renewals.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {upcomingRenewals.map((r) => (
                  <Card key={r.vendorId}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-deep-navy">{r.vendorName}</p>
                        <p className="text-sm text-gray-500">{r.planName} plan</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-deep-navy">
                          {new Date(r.nextRenewalAt).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'expired' && (
          <div>
            <h2 className="text-xl font-bold text-deep-navy mb-6">Expired Subscriptions</h2>
            {expiredSubscriptions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No expired subscriptions.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {expiredSubscriptions.map((s) => (
                  <Card key={s.vendorId}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-deep-navy">{s.vendorName}</p>
                        <p className="text-sm text-gray-500">{s.planName} plan</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-600">
                          Expired: {new Date(s.expiredAt).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}