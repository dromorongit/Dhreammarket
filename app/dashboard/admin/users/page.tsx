'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import Link from 'next/link'

interface User {
  id: string
  email: string
  role: string
  status: string
  createdAt: string
  profile?: {
    firstName: string | null
    lastName: string | null
  }
  store?: {
    id: string
    name: string
    isVerified: boolean
  } | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({ role: '', search: '' })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Reset password dialog state
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [resetMode, setResetMode] = useState<'link' | 'manual'>('link')
  const [resetPassword, setResetPassword] = useState('')
  const [resetExpireSessions, setResetExpireSessions] = useState(true)
  const [resetSubmitting, setResetSubmitting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [resetMessageType, setResetMessageType] = useState<'success' | 'error'>('success')
  const [showResetPassword, setShowResetPassword] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (filters.role) params.set('role', filters.role)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/admin/users?${params}`)
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to load users')
        return
      }
      
      setUsers(data.users)
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (err) {
      setError('Failed to fetch users')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters.role, filters.search])

  useEffect(() => {
    fetchUsers()
    fetchUserRole()
  }, [fetchUsers])

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUserRole(data.user?.role || null)
        setCurrentUserId(data.user?.id || null)
      }
    } catch (e) {
      console.error('Failed to fetch user role:', e)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchUsers()
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800'
      case 'VENDOR':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'BANNED':
        return 'bg-red-100 text-red-800'
      case 'DISABLED':
        return 'bg-gray-100 text-gray-800'
      case 'SUSPENDED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleUserAction = async (userId: string, action: string) => {
    if (actionLoading) return

    const confirmMessage = getConfirmMessage(action)
    if (!confirm(confirmMessage)) return

    try {
      setActionLoading(userId)
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || `Failed to ${action} user`)
        return
      }

      // Refresh the list
      fetchUsers()
    } catch (err) {
      alert(`Failed to ${action} user`)
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (actionLoading) return

    if (!confirm(`Are you sure you want to delete user "${userEmail}"? This action cannot be undone.`)) {
      return
    }

    try {
      setActionLoading(userId)
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to delete user')
        return
      }

      // Refresh the list
      fetchUsers()
    } catch (err) {
      alert('Failed to delete user')
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  const getConfirmMessage = (action: string) => {
    switch (action) {
      case 'ban':
        return 'Are you sure you want to ban this user? They will not be able to access their account.'
      case 'unban':
        return 'Are you sure you want to unban this user? They will regain access to their account.'
      case 'disable':
        return 'Are you sure you want to disable this user? Their account will be deactivated.'
      case 'reactivate':
        return 'Are you sure you want to reactivate this user? Their account will be restored.'
      default:
        return 'Are you sure you want to proceed?'
    }
  }

  const canPerformAction = (user: User, action: string) => {
    // SUPER_ADMIN cannot be managed
    if (user.role === 'SUPER_ADMIN') return false
    // Only SUPER_ADMIN can manage ADMIN accounts
    if (user.role === 'ADMIN' && action !== 'delete') return false
    return true
  }

  const isSuperAdmin = userRole === 'SUPER_ADMIN'

  const canResetPassword = (user: User) => {
    if (!isSuperAdmin) return false
    if (user.role === 'SUPER_ADMIN') return false
    if (user.id === currentUserId) return false
    return true
  }

  const closeResetDialog = () => {
    setShowResetDialog(false)
    setResetTarget(null)
    setResetMode('link')
    setResetPassword('')
    setResetExpireSessions(true)
    setResetError(null)
    setResetMessage(null)
    setResetSubmitting(false)
  }

  const handleResetPassword = async () => {
    if (!resetTarget || resetSubmitting) return
    setResetError(null)
    setResetMessage(null)

    try {
      setResetSubmitting(true)
      const body: { mode: string; newPassword?: string; expireSessions: boolean } = {
        mode: resetMode,
        expireSessions: resetExpireSessions,
      }
      if (resetMode === 'manual') body.newPassword = resetPassword

      const response = await fetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 429) {
          setResetError('Too many resets. Try again later.')
        } else if (response.status === 502) {
          setResetError('Could not send the reset email. Nothing was changed.')
        } else {
          setResetError(data.error || 'Failed to reset password')
        }
        return
      }

      setResetSubmitting(false)
      if (resetMode === 'link') {
        const sent = data.emailSent !== false
        setResetMessage(sent ? 'Reset link sent to ' + resetTarget.email : 'Reset link could not be emailed; nothing was changed.')
        setResetMessageType(sent ? 'success' : 'error')
      } else {
        const sent = data.emailSent !== false
        setResetMessage(sent ? 'Password updated.' : 'Password updated, but the notification email could not be sent.')
        setResetMessageType('success')
      }

      setResetPassword('')
      setShowResetDialog(false)
      setResetTarget(null)
      setResetMode('link')
      setResetExpireSessions(true)
      fetchUsers()
    } catch (err) {
      setResetSubmitting(false)
      setResetError('Network error. Please try again.')
      console.error(err)
    } finally {
      setResetSubmitting(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button onClick={fetchUsers} className="mt-2 text-sm text-red-600 hover:underline">
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Users</h1>
            <p className="text-gray-600 mt-1">Manage platform users</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Roles</option>
                <option value="ADMIN">Admin</option>
                <option value="VENDOR">Vendor</option>
                <option value="CUSTOMER">Customer</option>
              </select>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">User List</h2>
              <span className="text-sm text-gray-600">{pagination.total} users</span>
            </div>
          </CardHeader>
          {loading ? (
            <CardContent className="p-8 text-center">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          ) : users.length === 0 ? (
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">Try adjusting your search or filters.</p>
            </CardContent>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-gray-200">
                {users.map((user) => (
                  <div key={user.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{user.email}</p>
                        {user.profile?.firstName && (
                          <p className="text-sm text-gray-500">{user.profile.firstName} {user.profile.lastName}</p>
                        )}
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-1 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(user.status)}`}>
                          {user.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Joined:</span>
                        <span className="ml-1">{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {user.store && (
                      <div className="text-sm">
                        <span className="text-gray-500">Store:</span>
                        <span className="ml-1 text-gray-900">{user.store.name}</span>
                        <span className={`ml-2 inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${user.store.isVerified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {user.store.isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {actionLoading === user.id ? (
                        <span className="text-sm text-gray-500">Processing...</span>
                      ) : (
                        <>
                          {canPerformAction(user, 'ban') && user.status !== 'BANNED' && (
                            <button
                              onClick={() => handleUserAction(user.id, 'ban')}
                              className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 min-h-[44px]"
                              title="Ban user"
                            >
                              Ban
                            </button>
                          )}
                          {canPerformAction(user, 'unban') && user.status === 'BANNED' && (
                            <button
                              onClick={() => handleUserAction(user.id, 'unban')}
                              className="px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 min-h-[44px]"
                              title="Unban user"
                            >
                              Unban
                            </button>
                          )}
                          {canPerformAction(user, 'disable') && user.status !== 'DISABLED' && user.status !== 'BANNED' && (
                            <button
                              onClick={() => handleUserAction(user.id, 'disable')}
                              className="px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 min-h-[44px]"
                              title="Disable user"
                            >
                              Disable
                            </button>
                          )}
                          {canPerformAction(user, 'reactivate') && (user.status === 'DISABLED' || user.status === 'SUSPENDED') && (
                            <button
                              onClick={() => handleUserAction(user.id, 'reactivate')}
                              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 min-h-[44px]"
                              title="Reactivate user"
                            >
                              Reactivate
                            </button>
                          )}
                          {canPerformAction(user, 'delete') && (
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 min-h-[44px]"
                              title="Delete user"
                            >
                              Delete
                            </button>
                          )}
                          {canResetPassword(user) && (
                            <button
                              onClick={() => {
                                setResetTarget(user)
                                setShowResetDialog(true)
                              }}
                              className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 underline min-h-[44px]"
                              title="Reset password"
                            >
                              Reset Password
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          {user.profile?.firstName && (
                            <div className="text-sm text-gray-500">
                              {user.profile.firstName} {user.profile.lastName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(user.status)}`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.store ? (
                            <Link 
                              href={`/dashboard/admin/vendors?id=${user.store.id}`}
                              className="text-sm text-blue-600 hover:underline"
                            >
                              {user.store.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.store ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              user.store.isVerified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.store.isVerified ? 'Verified' : 'Pending'}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          {actionLoading === user.id ? (
                            <span className="text-sm text-gray-500">Processing...</span>
                          ) : (
                            <div className="flex gap-2 flex-wrap">
                              {canPerformAction(user, 'ban') && user.status !== 'BANNED' && (
                                <button
                                  onClick={() => handleUserAction(user.id, 'ban')}
                                  className="text-sm text-red-600 hover:text-red-800"
                                  title="Ban user"
                                >
                                  Ban
                                </button>
                              )}
                              {canPerformAction(user, 'unban') && user.status === 'BANNED' && (
                                <button
                                  onClick={() => handleUserAction(user.id, 'unban')}
                                  className="text-sm text-green-600 hover:text-green-800"
                                  title="Unban user"
                                >
                                  Unban
                                </button>
                              )}
                              {canPerformAction(user, 'disable') && user.status !== 'DISABLED' && user.status !== 'BANNED' && (
                                <button
                                  onClick={() => handleUserAction(user.id, 'disable')}
                                  className="text-sm text-yellow-600 hover:text-yellow-800"
                                  title="Disable user"
                                >
                                  Disable
                                </button>
                              )}
                              {canPerformAction(user, 'reactivate') && (user.status === 'DISABLED' || user.status === 'SUSPENDED') && (
                                <button
                                  onClick={() => handleUserAction(user.id, 'reactivate')}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                  title="Reactivate user"
                                >
                                  Reactivate
                                </button>
                              )}
                              {canPerformAction(user, 'delete') && (
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                  className="text-sm text-red-600 hover:text-red-800"
                                  title="Delete user"
                                >
                                  Delete
                                </button>
                              )}
                              {canResetPassword(user) && (
                                <button
                                  onClick={() => {
                                    setResetTarget(user)
                                    setShowResetDialog(true)
                                  }}
                                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                                  title="Reset password"
                                >
                                  Reset Password
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Reset Password Dialog */}
        {showResetDialog && resetTarget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6" onClick={closeResetDialog}>
            <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset password for {resetTarget.email}</h3>

              {resetError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">{resetError}</div>
              )}
              {resetMessage && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">{resetMessage}</div>
              )}

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Reset method</p>
                <label className="flex items-start gap-2 mb-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resetMode"
                    value="link"
                    checked={resetMode === 'link'}
                    onChange={() => setResetMode('link')}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">Send reset link by email</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">The user receives a link valid for 1 hour to create a new password.</p>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="resetMode"
                    value="manual"
                    checked={resetMode === 'manual'}
                    onChange={() => setResetMode('manual')}
                    className="mt-1"
                  />
                  <span className="text-sm text-gray-700">Set a password manually</span>
                </label>
                {resetMode === 'manual' && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">
                      The user is not forced to change it at next login, so tell them to change it right away.
                    </p>
                    <div className="relative">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="New password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
                      >
                        {showResetPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <ul className="text-xs mt-1 text-gray-500 list-disc list-inside space-y-0.5">
                      <li>8+ characters</li>
                      <li>Uppercase letter</li>
                      <li>Lowercase letter</li>
                      <li>Number</li>
                      <li>Special character</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetExpireSessions}
                    onChange={() => setResetExpireSessions(!resetExpireSessions)}
                  />
                  <span className="text-sm text-gray-700">Sign the user out of all devices</span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeResetDialog}
                  disabled={resetSubmitting}
                  className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetSubmitting || (resetMode === 'manual' && !resetPassword)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetSubmitting ? 'Resetting...' : resetMode === 'link' ? 'Send Reset Link' : 'Set Password'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}