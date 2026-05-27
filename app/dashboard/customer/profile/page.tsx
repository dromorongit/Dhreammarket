'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { getAvailableRegions } from '@/lib/shipping'
import NeedHelpButton from '@/components/NeedHelpButton'

interface UserProfile {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  address: string | null
}

interface User {
  id: string
  email: string
  profile: UserProfile | null
}

export default function CustomerProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    region: '',
    city: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        if (data.user) {
          setFormData({
            firstName: data.user.profile?.firstName || '',
            lastName: data.user.profile?.lastName || '',
            email: data.user.email || '',
            phone: data.user.profile?.phone || '',
            address: data.user.profile?.address || '',
            region: '',
            city: '',
          })
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!formData.firstName.trim()) errors.firstName = 'First name is required'
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required'
    if (!formData.phone.trim()) errors.phone = 'Phone number is required'
    if (!formData.address.trim()) errors.address = 'Address is required'
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address: formData.address,
        }),
      })

      if (response.ok) {
        setMessage('Profile updated successfully')
        fetchProfile()
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to update profile')
      }
    } catch (err) {
      setError('An error occurred while updating profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-200 rounded w-48"></div>
            <div className="h-64 bg-slate-200 rounded"></div>
            <div className="h-64 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-slate-600">Unable to load profile. Please try again.</p>
              <Link href="/login">
                <Button className="mt-4">Login</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="premium">Account Settings</Badge>
            <div className="flex-1 h-px bg-gradient-to-r from-royal-blue/20 to-transparent"></div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">
            My Profile
          </h1>
          <p className="text-slate-600 mt-2">
            Manage your personal information and delivery addresses
          </p>
        </div>

        {/* Success/Error Messages */}
        {message && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-emerald-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {message}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-rose-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card variant="elevated">
              <CardHeader>
                <h2 className="text-xl font-semibold text-deep-navy">Personal Information</h2>
                <p className="text-slate-600 text-sm mt-1">Update your personal details</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    placeholder="Enter your first name"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    error={formErrors.firstName}
                    required
                  />
                  <Input
                    label="Last Name"
                    placeholder="Enter your last name"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    error={formErrors.lastName}
                    required
                  />
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      disabled
                      className="block w-full rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-slate-400 cursor-not-allowed"
                    />
                    <p className="text-sm text-slate-500">Email cannot be changed</p>
                  </div>
                  <Input
                    label="Phone Number"
                    type="tel"
                    placeholder="+233 XX XXX XXXX"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    error={formErrors.phone}
                    required
                  />
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardHeader>
                <h2 className="text-xl font-semibold text-deep-navy">Delivery Address</h2>
                <p className="text-slate-600 text-sm mt-1">Set your default delivery address</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    label="Street Address"
                    placeholder="Enter your delivery address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    error={formErrors.address}
                    required
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Region/State</label>
                      <select
                        value={formData.region}
                        onChange={(e) => handleInputChange('region', e.target.value)}
                        className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow"
                      >
                        <option value="">Select a region</option>
                        {getAvailableRegions().map((region) => (
                          <option key={region} value={region}>{region}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="City"
                      placeholder="Enter your city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                size="lg" 
                onClick={handleSave}
                disabled={saving}
                className="shadow-lg shadow-royal-blue/20"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card variant="elevated">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">Account Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Status</span>
                    <Badge variant="success" size="sm">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Member Since</span>
                    <span className="text-sm font-medium text-deep-navy">
                      {new Date().toLocaleDateString('en-GH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-600">Email</span>
                    <span className="text-sm font-medium text-deep-navy">{user.email}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">Quick Links</h3>
                <div className="space-y-3">
                  <Link href="/dashboard/customer/orders">
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      My Orders
                    </Button>
                  </Link>
                  <Link href="/cart">
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 110 4m0-2a2 2 0 11-2 2m2 2v1a2 2 0 102 2h2" />
                      </svg>
                      My Cart
                    </Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      Marketplace
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card variant="elevated">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-deep-navy mb-4">Need Help?</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Contact support for account-related issues.
                </p>
                <NeedHelpButton
                  variant="outline"
                  size="sm"
                  category="ACCOUNT"
                  fullWidth
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}