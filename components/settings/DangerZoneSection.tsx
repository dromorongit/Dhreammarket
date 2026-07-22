'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

interface DangerZoneSectionProps {
  onDeactivate?: () => void
  onDelete?: () => void
}

export default function DangerZoneSection({ onDeactivate, onDelete }: DangerZoneSectionProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDeactivate = async () => {
    setDeactivating(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/account/deactivate', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        setMessage(data.message || 'Account deactivated successfully')
        onDeactivate?.()
      } else {
        setError(data.error || 'Failed to deactivate account')
      }
    } catch {
      setError('An error occurred while deactivating account')
    } finally {
      setDeactivating(false)
    }
  }

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm')
      return
    }

    setDeleting(true)
    setMessage(null)
    setError(null)

    try {
      const response = await fetch('/api/account/delete', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        onDelete?.()
      } else {
        setError(data.error || 'Failed to delete account')
      }
    } catch {
      setError('An error occurred while deleting account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card variant="elevated" className="border-rose-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-rose-600">Danger Zone</h2>
          <Badge variant="danger" size="sm">Irreversible</Badge>
        </div>
        <p className="text-slate-600 text-sm mt-1">Once you delete your account, there is no going back. Please be certain.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-900">Deactivate Account</p>
              <p className="text-xs text-slate-500 mt-0.5">Temporarily disable your account. You can reactivate later.</p>
            </div>
            <Button variant="outline" onClick={handleDeactivate} disabled={deactivating} className="sm:w-auto w-full">
              {deactivating ? 'Deactivating...' : 'Deactivate Account'}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-rose-200 bg-rose-50">
            <div>
              <p className="text-sm font-medium text-rose-900">Delete Account</p>
              <p className="text-xs text-rose-600 mt-0.5">Permanently delete your account and all associated data.</p>
            </div>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} disabled={deleting} className="sm:w-auto w-full">
              Delete Account
            </Button>
          </div>
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
      </CardContent>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-deep-navy">Delete Account</h3>
            <p className="text-sm text-slate-600">
              This action cannot be undone. This will permanently delete your account and remove your data from our servers.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Type <span className="font-bold text-rose-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setConfirmText(''); setError(null) }} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting} className="flex-1">
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
