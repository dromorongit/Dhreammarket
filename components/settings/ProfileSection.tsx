'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/Input'
import { Button } from '@/components/Button'
import { Textarea } from '@/components/Textarea'
import SettingsSection from '@/components/settings/SettingsSection'
import AvatarUpload from '@/components/settings/AvatarUpload'
import { useSettingsUser } from '@/components/settings/SettingsContext'

interface UserProfile {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  address: string | null
}

interface ProfileSectionProps {
  initialProfile: UserProfile
}

export default function ProfileSection({ initialProfile }: ProfileSectionProps) {
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: initialProfile.firstName || '',
    lastName: initialProfile.lastName || '',
    email: initialProfile.email || '',
    phone: initialProfile.phone || '',
    address: initialProfile.address || '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [avatar, setAvatar] = useState<string | null>(null)
  const { user, refreshUser } = useSettingsUser()

  useEffect(() => {
    setFormData({
      firstName: initialProfile.firstName || '',
      lastName: initialProfile.lastName || '',
      email: initialProfile.email || '',
      phone: initialProfile.phone || '',
      address: initialProfile.address || '',
    })
  }, [initialProfile])

  useEffect(() => {
    setAvatar(user?.profile?.avatar || null)
  }, [user?.profile?.avatar])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!formData.firstName.trim()) errors.firstName = 'First name is required'
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required'
    if (!formData.phone.trim()) errors.phone = 'Phone number is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address: formData.address,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setMessage('Profile updated successfully')
        refreshUser()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setError(data.error || 'Failed to update profile')
      }
    } catch {
      setError('An error occurred while updating profile')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = (url: string) => {
    setAvatar(url)
    refreshUser()
  }

  return (
    <SettingsSection title="Profile Information" description="Update your personal information">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
        <AvatarUpload avatarUrl={avatar} onUpload={handleAvatarUpload} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name"
          placeholder="First name"
          value={formData.firstName}
          onChange={(e) => handleChange('firstName', e.target.value)}
          error={formErrors.firstName}
        />
        <Input
          label="Last Name"
          placeholder="Last name"
          value={formData.lastName}
          onChange={(e) => handleChange('lastName', e.target.value)}
          error={formErrors.lastName}
        />
        <Input
          label="Email Address"
          type="email"
          value={formData.email}
          disabled
          className="bg-slate-50 text-slate-500 cursor-not-allowed"
        />
        <Input
          label="Phone Number"
          type="tel"
          placeholder="+233 000 000 000"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          error={formErrors.phone}
        />
      </div>
      <div className="mt-4">
        <Textarea
          label="Address"
          placeholder="Enter your address"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
        />
      </div>

      {message && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-sm text-emerald-700">{message}</p>
        </div>
      )}
      {error && (
        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="md">
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </SettingsSection>
  )
}
