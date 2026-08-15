import VendorSuppliersValidation from './validation'
import VendorSuppliersPageClient from './page.client'

export default function VendorSuppliersPage() {
  return (
    <VendorSuppliersValidation>
      <VendorSuppliersPageClient />
    </VendorSuppliersValidation>
  )
}
