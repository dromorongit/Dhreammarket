import VendorQuickSaleValidation from './validation'
import VendorQuickSalePageClient from './page.client'

export default function VendorQuickSalePage() {
  const payLinkEnabled = process.env.PAYLINK_ENABLED === 'true'
  return (
    <VendorQuickSaleValidation>
      <VendorQuickSalePageClient payLinkEnabled={payLinkEnabled} />
    </VendorQuickSaleValidation>
  )
}
