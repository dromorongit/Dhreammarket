import VendorCustomersValidation from './validation'
import VendorCustomersPageClient from './page.client'

export default function VendorCustomersPage() {
  return (
    <VendorCustomersValidation>
      <VendorCustomersPageClient />
    </VendorCustomersValidation>
  )
}
