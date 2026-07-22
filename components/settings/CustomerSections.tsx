'use client'

import { useEffect, useState } from 'react'
import SettingsSection from '@/components/settings/SettingsSection'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

interface Address {
  id: string
  label?: string
  street: string
  region: string
  city: string
  isDefault?: boolean
}

interface CustomerSectionsProps {
  initialAddresses?: Address[]
}

export default function CustomerSections({ initialAddresses = [] }: CustomerSectionsProps) {
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses)

  return (
    <div className="space-y-6">
      <SettingsSection title="Shipping Addresses" description="Manage your delivery addresses">
        {addresses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-600 text-sm mb-3">No saved addresses</p>
            <Button size="sm">Add Address</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{addr.street}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{addr.city}, {addr.region}</p>
                </div>
                {addr.isDefault && <Badge variant="success" size="sm">Default</Badge>}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Saved Payment Methods" description="Your saved payment options">
        <div className="text-center py-8">
          <p className="text-slate-600 text-sm mb-3">No saved payment methods</p>
          <p className="text-xs text-slate-400">Payment methods will be available here once connected.</p>
        </div>
      </SettingsSection>

      <SettingsSection title="Wishlist Preferences" description="Customize your wishlist experience">
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Notifications when wishlist items go on sale: <span className="font-medium text-slate-900">Enabled</span></p>
          <p className="text-sm text-slate-600">Stock alerts for wishlist items: <span className="font-medium text-slate-900">Enabled</span></p>
        </div>
      </SettingsSection>
    </div>
  )
}
