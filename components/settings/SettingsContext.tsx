'use client'

import { createContext, useContext } from 'react'

interface UserProfile {
  id: string
  email: string
  role: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  address: string | null
  avatar?: string | null
  darkMode?: boolean
  language?: string
  currency?: string
  timezone?: string
  emailNotifications?: boolean
  orderNotifications?: boolean
  promotionalNotifications?: boolean
  systemNotifications?: boolean
}

interface User {
  id: string
  email: string
  role: string
  profile: UserProfile | null
}

interface SettingsContextValue {
  user: User | null
  setUser: (user: User | null) => void
  refreshUser: () => Promise<void>
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettingsUser() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error('useSettingsUser must be used within SettingsShell')
  }
  return ctx
}
