import VendorSalesValidation from './validation'
import VendorSalesPageClient from './page.client'

export default function VendorSalesPage() {
  return (
    <VendorSalesValidation>
      <VendorSalesPageClient />
    </VendorSalesValidation>
  )
}
