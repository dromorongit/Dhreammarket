import VendorProductCostsValidation from './validation'
import VendorProductCostsPageClient from './page.client'

export default function VendorProductCostsPage() {
  return (
    <VendorProductCostsValidation>
      <VendorProductCostsPageClient />
    </VendorProductCostsValidation>
  )
}
