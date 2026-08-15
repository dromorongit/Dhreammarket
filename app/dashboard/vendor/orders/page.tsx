import VendorOrdersValidation from './validation'
import VendorOrdersPageClient from './page.client'

export default function VendorOrdersPage() {
  return (
    <VendorOrdersValidation>
      <VendorOrdersPageClient />
    </VendorOrdersValidation>
  )
}
