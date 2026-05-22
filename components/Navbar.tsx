'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from './Button'
import { Badge } from './Badge'
import { SearchDropdown } from './SearchDropdown'

interface User {
  userId: string
  role: string
  email: string
  profile?: {
    firstName: string
    lastName: string
  }
}

interface Notification {
  id: string
  type: 'order' | 'payment' | 'system' | 'review'
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export function Navbar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [cartItemCount, setCartItemCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Fetch user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => setUser(data.user))
      .catch(err => console.error('Failed to get user:', err))
    
    // Fetch cart item count
    fetch('/api/cart')
      .then(res => res.json())
      .then(data => {
        if (data.cart && data.cart.items) {
          setCartItemCount(data.cart.items.length)
        }
      })
      .catch(err => console.error('Failed to get cart:', err))
  }, [])

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close user menu dropdown when clicking outside
  useEffect(() => {
    function handleUserMenuClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleUserMenuClickOutside)
      return () => document.removeEventListener('mousedown', handleUserMenuClickOutside)
    }
  }, [userMenuOpen])

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markAsRead = async (notificationId?: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          markAllRead: !notificationId,
        }),
      })
      if (response.ok) {
        fetchNotifications()
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'order':
        return '<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>'
      case 'payment':
        return '<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      case 'system':
        return '<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      case 'review':
        return '<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>'
      default:
        return '<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>'
    }
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  const closeMobileSearch = () => {
    setMobileSearchOpen(false)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    router.push('/')
    router.refresh()
    setMobileMenuOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 sm:h-20 items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-2 sm:gap-3 group" onClick={() => { closeMobileMenu(); closeMobileSearch(); }}>
              <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                <Image
                  src="/assets/images/dhreammarket.png"
                  alt="Dhream Market Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-deep-navy to-royal-blue bg-clip-text text-transparent group-hover:from-royal-blue group-hover:to-deep-navy transition-colors duration-300">
                  Dhream Market
                </span>
                <span className="text-[9px] sm:text-[10px] font-medium text-muted-text tracking-widest uppercase hidden sm:block">
                  Smart Commerce Ecosystem
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop: Centered Global Search */}
          <div className="hidden lg:block flex-1 max-w-2xl mx-8">
            <SearchDropdown />
          </div>

          {/* Desktop Navigation + Auth */}
          <div className="hidden lg:flex lg:items-center lg:space-x-1">
            <Link
              href="/"
              className="relative px-3 py-2 text-sm font-medium text-slate-600 hover:text-deep-navy transition-colors duration-200 group"
            >
              <span>Home</span>
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-royal-blue to-premium-gold rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
            </Link>
            <Link
              href="/marketplace"
              className="relative px-3 py-2 text-sm font-medium text-slate-600 hover:text-deep-navy transition-colors duration-200 group"
            >
              <span>Marketplace</span>
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-royal-blue to-premium-gold rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
            </Link>
            <Link
              href="/about"
              className="relative px-3 py-2 text-sm font-medium text-slate-600 hover:text-deep-navy transition-colors duration-200 group"
            >
              <span>About</span>
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-royal-blue to-premium-gold rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
            </Link>
            <Link
              href="/contact"
              className="relative px-3 py-2 text-sm font-medium text-slate-600 hover:text-deep-navy transition-colors duration-200 group"
            >
              <span>Contact</span>
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-royal-blue to-premium-gold rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
            </Link>
            <Link
              href="/help-center"
              className="relative px-3 py-2 text-sm font-medium text-slate-600 hover:text-deep-navy transition-colors duration-200 group"
            >
              <span>Support</span>
              <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-royal-blue to-premium-gold rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></span>
            </Link>
            {user && (
              <Link
                href="/cart"
                className="relative px-3 py-2 text-sm font-medium text-slate-600 hover:text-deep-navy transition-colors duration-200 group"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 010 4m0-2a2 2 0 01-2 2m2 2v1a2 2 0 002 2h2" />
                  </svg>
                  Cart
                </span>
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[10px] font-bold min-w-[18px] h-4 rounded-full flex items-center justify-center px-0.5">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </span>
                )}
              </Link>
            )}
          </div>

          {/* Desktop Auth & User Actions */}
          <div className="hidden lg:flex lg:items-center lg:space-x-3">
            {user ? (
              <>
                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className="relative p-2 text-slate-500 hover:text-deep-navy transition-colors duration-200 rounded-full hover:bg-slate-100"
                    aria-label="Notifications"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-gradient-to-r from-rose-500 to-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-premium-xl border border-slate-200 z-50 overflow-hidden animate-fade-in-up">
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-semibold text-deep-navy">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={() => markAsRead()}
                            className="text-xs font-medium text-royal-blue hover:text-royal-blue/80 transition-colors"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                            </div>
                            <p className="text-slate-500 text-sm">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.slice(0, 10).map((notification) => (
                            <div
                              key={notification.id}
                              onClick={() => !notification.isRead && markAsRead(notification.id)}
                              className={`p-4 border-b border-slate-100 cursor-pointer transition-colors duration-150 flex gap-3 ${!notification.isRead ? 'bg-royal-blue/5' : 'hover:bg-slate-50'}
                                ${notification.isRead ? 'opacity-60' : ''}`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0" dangerouslySetInnerHTML={{ __html: getNotificationIcon(notification.type) }} />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <p className={`text-sm font-medium ${!notification.isRead ? 'text-deep-navy' : 'text-slate-600'}`}>
                                    {notification.title}
                                  </p>
                                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                                    {formatNotificationDate(notification.createdAt)}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                  {notification.message}
                                </p>
                                {!notification.isRead && (
                                  <span className="inline-block w-1.5 h-1.5 bg-royal-blue rounded-full mt-2"></span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors duration-200"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                      {user.profile?.firstName?.charAt(0) || user.profile?.lastName?.charAt(0) || user.email?.charAt(0) || ''}
                    </div>
                    <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                      {user.profile?.firstName && user.profile?.lastName ? `${user.profile.firstName} ${user.profile.lastName}` : user.email}
                    </span>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-premium border border-slate-200 py-2 z-[100] animate-fade-in-up">
                    {user.role === 'SUPER_ADMIN' && (
                      <Link href="/dashboard/super-admin" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        Super Admin Dashboard
                      </Link>
                    )}
                    {user.role === 'SUPER_ADMIN' && (
                      <Link href="/dashboard/super-admin/product-categories" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        Product Categories
                      </Link>
                    )}
                    {user.role === 'SUPER_ADMIN' && (
                      <Link href="/dashboard/super-admin/homepage" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        Homepage Sections
                      </Link>
                    )}
                    {user.role === 'ADMIN' && (
                      <Link href="/dashboard/admin" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        Admin Dashboard
                      </Link>
                    )}
                    {user.role === 'VENDOR' && (
                      <Link href="/dashboard/vendor" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        Vendor Dashboard
                      </Link>
                    )}
                    {user.role === 'CUSTOMER' && (
                      <Link href="/dashboard/customer" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                        My Account
                      </Link>
                    )}
                    <div className="border-t border-slate-100 my-2"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile: Search Icon + Hamburger */}
          <div className="lg:hidden flex items-center gap-1">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen)
                setMobileMenuOpen(false)
              }}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Toggle search"
            >
              <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen)
                setMobileSearchOpen(false)
              }}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Bar (expandable) */}
      <div className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
        mobileSearchOpen ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-4 pb-3 pt-1 border-b border-slate-200 bg-white overflow-hidden">
          <SearchDropdown onNavigate={closeMobileSearch} />
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
        mobileMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-4 py-4 space-y-1 border-t border-slate-200 bg-white">
          <Link href="/" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
            Home
          </Link>
          <Link href="/marketplace" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
            Marketplace
          </Link>
          <Link href="/about" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
            About
          </Link>
          <Link href="/contact" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
            Contact
          </Link>
          <Link href="/help-center" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
            Support
          </Link>
          {user && (
            <Link href="/cart" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 010 4m0-2a2 2 0 01-2 2m2 2v1a2 2 0 002 2h2" />
                </svg>
                Cart
                {cartItemCount > 0 && (
                  <span className="ml-auto bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {cartItemCount}
                  </span>
                )}
              </span>
            </Link>
          )}
          <div className="border-t border-slate-200 my-2"></div>
          {user ? (
            <>
               <div className="px-4 py-2">
                 <p className="text-sm font-medium text-slate-700">Welcome, {user.profile?.firstName && user.profile?.lastName ? `${user.profile.firstName} ${user.profile.lastName}` : user.email}</p>
               </div>
               {user.role === 'SUPER_ADMIN' && (
                 <Link href="/dashboard/super-admin" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                   Super Admin Dashboard
                 </Link>
               )}
               {user.role === 'SUPER_ADMIN' && (
                 <Link href="/dashboard/super-admin/product-categories" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                   Product Categories
                 </Link>
               )}
               {user.role === 'SUPER_ADMIN' && (
                 <Link href="/dashboard/super-admin/homepage" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                   Homepage Sections
                 </Link>
               )}
               {user.role === 'ADMIN' && (
                 <Link href="/dashboard/admin" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                   Admin Dashboard
                 </Link>
               )}
               {user.role === 'VENDOR' && (
                 <Link href="/dashboard/vendor" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                   Vendor Dashboard
                 </Link>
               )}
               {user.role === 'CUSTOMER' && (
                 <Link href="/dashboard/customer" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                   My Account
                 </Link>
               )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors mt-2"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
                Sign In
              </Link>
              <Link href="/register" onClick={closeMobileMenu} className="block px-4 py-3 rounded-xl bg-deep-navy text-white text-center font-medium hover:bg-royal-blue transition-colors mt-2">
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}