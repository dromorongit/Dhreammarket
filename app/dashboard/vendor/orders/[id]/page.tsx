import VendorOrderDetailValidation from './validation'
import VendorOrderDetailPageClient from './page.client'

export default function VendorOrderDetailPage() {
  return (
    <VendorOrderDetailValidation>
      <VendorOrderDetailPageClient />
    </VendorOrderDetailValidation>
  )
}
