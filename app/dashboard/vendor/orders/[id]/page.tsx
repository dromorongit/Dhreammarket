import VendorOrderDetailValidation from './validation'
import VendorOrderDetailPageClient from './page.client'

export default function VendorOrderDetailPage() {
  const payLinkEnabled = process.env.PAYLINK_ENABLED === 'true'
  return (
    <VendorOrderDetailValidation>
      <VendorOrderDetailPageClient payLinkEnabled={payLinkEnabled} />
    </VendorOrderDetailValidation>
  )
}
