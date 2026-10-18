import VendorQuickSaleValidation from './validation'
import VendorQuickSalePageClient from './page.client'

export default function VendorQuickSalePage() {
  return (
    <VendorQuickSaleValidation>
      <VendorQuickSalePageClient />
    </VendorQuickSaleValidation>
  )
}
