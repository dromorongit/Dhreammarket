import VendorSettingsValidation from './validation'
import VendorSettingsPageClient from './page.client'

export default function VendorSettingsPage() {
  return (
    <VendorSettingsValidation>
      <VendorSettingsPageClient />
    </VendorSettingsValidation>
  )
}
