import VendorNewServiceValidation from './validation'
import VendorNewServicePageClient from './page.client'

export default function VendorNewServicePage() {
  return (
    <VendorNewServiceValidation>
      <VendorNewServicePageClient />
    </VendorNewServiceValidation>
  )
}
