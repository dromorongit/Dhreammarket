import VendorProductsValidation from './validation'
import VendorProductsPageClient from './page.client'

export default function VendorProductsPage() {
  return (
    <VendorProductsValidation>
      <VendorProductsPageClient />
    </VendorProductsValidation>
  )
}
