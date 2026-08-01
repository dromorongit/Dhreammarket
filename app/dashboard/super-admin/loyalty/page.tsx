'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'

interface LoyaltyTier {
  id: string
  name: string
  slug: string
  color: string
  minPoints: number
  maxPoints: number | null
  multiplier: number
  pointEarningRate: number
  cashbackRate: number
  description: string | null
  isActive: boolean
  displayOrder: number
}

interface LoyaltyConfig {
  [key: string]: any
}

interface Achievement {
  id: string
  name: string
  slug: string
  description: string | null
  badge: string | null
  color: string | null
  icon: string | null
  criteria: any
  points: number
  cashbackReward: number
  isActive: boolean
  displayOrder: number
}

export default function SuperAdminLoyaltyPage() {
  const [activeTab, setActiveTab] = useState('config')
  const [tiers, setTiers] = useState<LoyaltyTier[]>([])
  const [config, setConfig] = useState<LoyaltyConfig>({})
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchLoyaltyData()
  }, [])

  const fetchLoyaltyData = async () => {
    try {
      const [tiersRes, configRes, achievementsRes] = await Promise.all([
        fetch('/api/loyalty/admin/tiers'),
        fetch('/api/loyalty/admin/config'),
        fetch('/api/loyalty/admin/achievements'),
      ])

      if (tiersRes.ok) setTiers(await tiersRes.json())
      if (configRes.ok) setConfig(await configRes.json())
      if (achievementsRes.ok) setAchievements(await achievementsRes.json())
    } catch (error) {
      console.error('Error fetching loyalty data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfigUpdate = async (key: string, value: any) => {
    try {
      setSaving(true)
      await fetch('/api/loyalty/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      setConfig((prev) => ({ ...prev, [key]: value }))
    } catch (error) {
      console.error('Error updating config:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleTierUpdate = async (id: string, field: string, value: any) => {
    try {
      setSaving(true)
      await fetch(`/api/loyalty/admin/tiers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      setTiers((prev) =>
        prev.map((tier) =>
          tier.id === id ? { ...tier, [field]: value } : tier
        )
      )
    } catch (error) {
      console.error('Error updating tier:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">Loyalty & Rewards Configuration</h1>

        <div className="flex gap-2 mb-8 border-b border-gray-200">
          {[
            { key: 'config', label: 'Configuration' },
            { key: 'tiers', label: 'Loyalty Tiers' },
            { key: 'achievements', label: 'Achievements' },
            { key: 'campaigns', label: 'Campaigns' },
            { key: 'analytics', label: 'Analytics' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-royal-blue text-royal-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'config' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-deep-navy">Reward Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Point Earning</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points per Purchase (per GHS)
                    </label>
                    <Input
                      type="number"
                      value={config.pointsPerPurchase ?? 10}
                      onChange={(e) => handleConfigUpdate('pointsPerPurchase', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points per Service Booking (per GHS)
                    </label>
                    <Input
                      type="number"
                      value={config.pointsPerBooking ?? 10}
                      onChange={(e) => handleConfigUpdate('pointsPerBooking', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points for Review
                    </label>
                    <Input
                      type="number"
                      value={config.pointsPerReview ?? 5}
                      onChange={(e) => handleConfigUpdate('pointsPerReview', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points for Review Image
                    </label>
                    <Input
                      type="number"
                      value={config.pointsPerReviewImage ?? 2}
                      onChange={(e) => handleConfigUpdate('pointsPerReviewImage', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Points for Review Video
                    </label>
                    <Input
                      type="number"
                      value={config.pointsPerReviewVideo ?? 3}
                      onChange={(e) => handleConfigUpdate('pointsPerReviewVideo', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Daily Login Points
                    </label>
                    <Input
                      type="number"
                      value={config.dailyLoginPoints ?? 2}
                      onChange={(e) => handleConfigUpdate('dailyLoginPoints', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Profile Completion Points
                    </label>
                    <Input
                      type="number"
                      value={config.profileCompletionPoints ?? 20}
                      onChange={(e) => handleConfigUpdate('profileCompletionPoints', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Follow Vendor Points
                    </label>
                    <Input
                      type="number"
                      value={config.followVendorPoints ?? 5}
                      onChange={(e) => handleConfigUpdate('followVendorPoints', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wishlist Activity Points
                    </label>
                    <Input
                      type="number"
                      value={config.wishlistActivityPoints ?? 3}
                      onChange={(e) => handleConfigUpdate('wishlistActivityPoints', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Collection Creation Points
                    </label>
                    <Input
                      type="number"
                      value={config.collectionCreationPoints ?? 10}
                      onChange={(e) => handleConfigUpdate('collectionCreationPoints', parseFloat(e.target.value))}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-deep-navy">Cashback & Referral</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Cashback Rate (%)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.defaultCashbackRate ?? 0}
                      onChange={(e) => handleConfigUpdate('defaultCashbackRate', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Referral Reward Points
                    </label>
                    <Input
                      type="number"
                      value={config.referralRewardPoints ?? 100}
                      onChange={(e) => handleConfigUpdate('referralRewardPoints', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Referral Cashback Reward (GHS)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.referralRewardCashback ?? 5}
                      onChange={(e) => handleConfigUpdate('referralRewardCashback', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enable Purchase Rewards
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      value={config.enablePurchaseRewards ?? true}
                      onChange={(e) => handleConfigUpdate('enablePurchaseRewards', e.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enable Service Booking Rewards
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      value={config.enableBookingRewards ?? true}
                      onChange={(e) => handleConfigUpdate('enableBookingRewards', e.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enable Review Rewards
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      value={config.enableReviewRewards ?? true}
                      onChange={(e) => handleConfigUpdate('enableReviewRewards', e.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Enable Daily Login Rewards
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      value={config.enableDailyLoginRewards ?? true}
                      onChange={(e) => handleConfigUpdate('enableDailyLoginRewards', e.target.value === 'true')}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'tiers' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-deep-navy">Loyalty Tiers</h2>
            <div className="space-y-4">
              {tiers.map((tier) => (
                <Card key={tier.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
                        style={{ backgroundColor: tier.color, color: '#fff' }}
                      >
                        {tier.name[0]}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-deep-navy">{tier.name}</h3>
                        <p className="text-sm text-gray-500">
                          {tier.minPoints.toLocaleString()} - {tier.maxPoints ? tier.maxPoints.toLocaleString() : '∞'} points
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <label className="block text-xs text-gray-500">Multiplier</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={tier.multiplier}
                            onChange={(e) => handleTierUpdate(tier.id, 'multiplier', parseFloat(e.target.value))}
                            className="w-20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Earning Rate</label>
                          <Input
                            type="number"
                            step="0.1"
                            value={tier.pointEarningRate}
                            onChange={(e) => handleTierUpdate(tier.id, 'pointEarningRate', parseFloat(e.target.value))}
                            className="w-20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">Cashback %</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={tier.cashbackRate}
                            onChange={(e) => handleTierUpdate(tier.id, 'cashbackRate', parseFloat(e.target.value))}
                            className="w-20"
                          />
                        </div>
                      </div>
                      <Badge className={tier.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {tier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'achievements' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-deep-navy">Achievement Badges</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) => (
                <Card key={achievement.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-lg">
                        {achievement.icon ?? '🏆'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-deep-navy">{achievement.name}</h4>
                        <p className="text-xs text-gray-500">{achievement.slug}</p>
                      </div>
                    </div>
                    {achievement.description && (
                      <p className="text-sm text-gray-600 mb-3">{achievement.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-amber-600 font-medium">+{achievement.points} pts</span>
                      <Badge className={achievement.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {achievement.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-deep-navy">Vendor Reward Campaigns</h2>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">Campaign management interface coming soon</p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-deep-navy">Loyalty Analytics</h2>
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">Analytics dashboard coming soon</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}