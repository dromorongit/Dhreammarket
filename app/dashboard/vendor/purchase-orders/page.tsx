import VendorPurchaseOrdersValidation from './validation'
import VendorPurchaseOrdersPageClient from './page.client'

export default function VendorPurchaseOrdersPage() {
  return (
    <VendorPurchaseOrdersValidation>
      <VendorPurchaseOrdersPageClient />
    </VendorPurchaseOrdersValidation>
  )
}
