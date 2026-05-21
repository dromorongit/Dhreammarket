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
  }, [fetchUsers])

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
              <div className="overflow-x-auto">
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
      </div>
    </div>
  )
}