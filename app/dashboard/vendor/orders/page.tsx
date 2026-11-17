import VendorOrdersValidation from './validation'
import VendorOrdersPageClient from './page.client'

export default function VendorOrdersPage() {
  const payLinkEnabled = process.env.PAYLINK_ENABLED !== 'false'
  return (
    <VendorOrdersValidation>
      <VendorOrdersPageClient payLinkEnabled={payLinkEnabled} />
    </VendorOrdersValidation>
  )
}
