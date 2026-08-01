'use client'

import Link from 'next/link'
import SettingsShell from '@/components/settings/SettingsShell'
import ProfileSection from '@/components/settings/ProfileSection'
import PreferencesSection from '@/components/settings/PreferencesSection'
import NotificationSection from '@/components/settings/NotificationSection'
import SecuritySection from '@/components/settings/SecuritySection'
import DangerZoneSection from '@/components/settings/DangerZoneSection'
import SuperAdminSections from '@/components/settings/SuperAdminSections'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { useSettingsUser } from '@/components/settings/SettingsContext'

export default function SuperAdminSettingsPage() {
  return (
    <SettingsShell role="SUPER_ADMIN" dashboardHref="/dashboard/super-admin">
      <SuperAdminSettingsContent />
    </SettingsShell>
  )
}

function SuperAdminSettingsContent() {
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

      <SuperAdminSections />

      <DangerZoneSection />

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-deep-navy">Loyalty & Rewards</h3>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/super-admin/loyalty" className="text-royal-blue hover:underline text-sm">
            Configure loyalty tiers, rewards, achievements, and campaigns
          </Link>
        </CardContent>
      </Card>
    </>
  )
}
