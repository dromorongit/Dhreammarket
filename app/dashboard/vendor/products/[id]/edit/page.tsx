import VendorEditProductValidation from './validation'
import VendorEditProductPageClient from './page.client'

export default function VendorEditProductPage() {
  return (
    <VendorEditProductValidation>
      <VendorEditProductPageClient />
    </VendorEditProductValidation>
  )
}
