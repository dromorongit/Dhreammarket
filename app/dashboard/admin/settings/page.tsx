'use client'

import SettingsShell from '@/components/settings/SettingsShell'
import ProfileSection from '@/components/settings/ProfileSection'
import PreferencesSection from '@/components/settings/PreferencesSection'
import NotificationSection from '@/components/settings/NotificationSection'
import SecuritySection from '@/components/settings/SecuritySection'
import DangerZoneSection from '@/components/settings/DangerZoneSection'
import AdminSections from '@/components/settings/AdminSections'
import { useSettingsUser } from '@/components/settings/SettingsContext'

export default function AdminSettingsPage() {
  const { user } = useSettingsUser()

  return (
    <SettingsShell role="ADMIN" dashboardHref="/dashboard/admin">
      <ProfileSection
        initialProfile={
          user?.profile
            ? {
                id: user.profile.id,
                email: user.email,
                role: user.role,
                firstName: user.profile.firstName,
                lastName: user.profile.lastName,
                phone: user.profile.phone,
                address: user.profile.address,
              }
            : {
                id: '',
                email: '',
                role: 'ADMIN',
                firstName: null,
                lastName: null,
                phone: null,
                address: null,
              }
        }
      />

      <PreferencesSection
        initialPreferences={{
          darkMode: user?.profile?.darkMode ?? false,
          language: user?.profile?.language ?? 'en',
          currency: user?.profile?.currency ?? 'GHS',
          timezone: user?.profile?.timezone ?? 'Africa/Accra',
        }}
      />

      <NotificationSection
        initialNotifications={{
          emailNotifications: user?.profile?.emailNotifications ?? true,
          orderNotifications: user?.profile?.orderNotifications ?? true,
          promotionalNotifications: user?.profile?.promotionalNotifications ?? false,
          systemNotifications: user?.profile?.systemNotifications ?? true,
        }}
      />

      <SecuritySection />

      <AdminSections />

      <DangerZoneSection />
    </SettingsShell>
  )
}
