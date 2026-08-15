import VendorEarningsValidation from './validation'
import VendorEarningsPageClient from './page.client'

export default function VendorEarningsPage() {
  return (
    <VendorEarningsValidation>
      <VendorEarningsPageClient />
    </VendorEarningsValidation>
  )
}
