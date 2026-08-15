import VendorEditServiceValidation from './validation'
import VendorEditServicePageClient from './page.client'

export default function VendorEditServicePage() {
  return (
    <VendorEditServiceValidation>
      <VendorEditServicePageClient />
    </VendorEditServiceValidation>
  )
}
