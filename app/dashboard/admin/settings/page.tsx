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
  return (
    <SettingsShell role="ADMIN" dashboardHref="/dashboard/admin">
      <AdminSettingsContent />
    </SettingsShell>
  )
}

function AdminSettingsContent() {
  const { user } = useSettingsUser()

  return (
    <>
      <ProfileSection
        initialProfile={
              user?.profile
                ? {
                    id: user.profile.id,
                    email: user.email,
                    firstName: user.profile.firstName,
                lastName: user.profile.lastName,
                phone: user.profile.phone,
                address: user.profile.address,
              }
                : {
                    id: '',
                    email: '',
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
          currency: user?.profile?.currency ?? '',
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
    </>
  )
}
