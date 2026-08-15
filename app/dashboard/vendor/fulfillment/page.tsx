import VendorFulfillmentValidation from './validation'
import VendorFulfillmentPageClient from './page.client'

export default function VendorFulfillmentPage() {
  return (
    <VendorFulfillmentValidation>
      <VendorFulfillmentPageClient />
    </VendorFulfillmentValidation>
  )
}
