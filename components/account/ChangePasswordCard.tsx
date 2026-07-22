'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/Card'
import { Button } from '@/components/Button'
import { PasswordInput } from '@/components/PasswordInput'

interface ChangePasswordCardProps {
  className?: string
}

export default function ChangePasswordCard({ className }: ChangePasswordCardProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    if (!password) return { score: 0, label: '', color: '' }
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[a-z]/.test(password)) score++
    if (/\d/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 2) return { score, label: 'Weak', color: 'bg-rose-500' }
    if (score === 3) return { score, label: 'Fair', color: 'bg-amber-500' }
    if (score === 4) return { score, label: 'Good', color: 'bg-blue-500' }
    return { score, label: 'Strong', color: 'bg-emerald-500' }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!currentPassword.trim()) {
      errors.currentPassword = 'Current password is required'
    }

    if (!newPassword) {
      errors.newPassword = 'New password is required'
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters long'
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one uppercase letter'
    } else if (!/[a-z]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one lowercase letter'
    } else if (!/\d/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one number'
    } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
      errors.newPassword = 'Password must contain at least one special character'
    }

    if (!confirmNewPassword) {
      errors.confirmNewPassword = 'Please confirm your new password'
    } else if (newPassword !== confirmNewPassword) {
      errors.confirmNewPassword = 'Passwords do not match'
    }

    if (newPassword && currentPassword && newPassword === currentPassword) {
      errors.newPassword = 'New password must be different from current password'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
        setFormErrors({})
      } else {
        setError(data.error || 'Failed to change password')
      }
    } catch {
      setError('An error occurred while changing password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <h2 className="text-xl font-semibold text-deep-navy">Change Password</h2>
        <p className="text-slate-600 text-sm mt-1">Update your password to keep your account secure</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            error={formErrors.currentPassword}
            autoComplete="current-password"
          />
          <div>
            <PasswordInput
              label="New Password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                if (formErrors.newPassword) {
                  setFormErrors((prev) => ({ ...prev, newPassword: '' }))
                }
              }}
              error={formErrors.newPassword}
              autoComplete="new-password"
            />
            {newPassword && !formErrors.newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength(newPassword).color}`}
                      style={{ width: `${(getPasswordStrength(newPassword).score / 5) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-slate-600 min-w-[3rem] text-right">
                    {getPasswordStrength(newPassword).label}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {[
                    { test: newPassword.length >= 8, label: '8+ chars' },
                    { test: /[A-Z]/.test(newPassword), label: 'Uppercase' },
                    { test: /[a-z]/.test(newPassword), label: 'Lowercase' },
                    { test: /\d/.test(newPassword), label: 'Number' },
                    { test: /[^A-Za-z0-9]/.test(newPassword), label: 'Special char' },
                  ].map((req, idx) => (
                    <div key={idx} className={`flex items-center gap-1 text-xs ${req.test ? 'text-emerald-600' : 'text-slate-400'}`}>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {req.test ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        )}
                      </svg>
                      {req.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <PasswordInput
            label="Confirm New Password"
            value={confirmNewPassword}
            onChange={(e) => {
              setConfirmNewPassword(e.target.value)
              if (formErrors.confirmNewPassword) {
                setFormErrors((prev) => ({ ...prev, confirmNewPassword: '' }))
              }
            }}
            error={formErrors.confirmNewPassword}
            autoComplete="new-password"
          />
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex flex-col items-stretch gap-3">
          {message && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <p className="text-emerald-700 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {message}
              </p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-rose-700 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            </div>
          )}
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={saving}
            className="shadow-lg shadow-royal-blue/20"
          >
            {saving ? 'Changing Password...' : 'Change Password'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
