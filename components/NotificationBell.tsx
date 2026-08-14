'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Notification {
  id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  type: string
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications?unreadOnly=true')
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.unreadCount || 0)
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-royal-blue transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-deep-navy">Notifications</h3>
            </div>
            <div className="overflow-y-auto max-h-64">
              {notifications.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No notifications</p>
              ) : (
                notifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <p className="text-sm font-medium text-deep-navy">{notification.title}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100">
              <Link
                href="/dashboard/notifications"
                className="block text-center text-sm text-royal-blue hover:underline"
                onClick={() => setShowDropdown(false)}
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

