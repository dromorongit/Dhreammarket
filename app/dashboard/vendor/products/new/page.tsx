import VendorNewProductValidation from './validation'
import VendorNewProductPageClient from './page.client'

export default function VendorNewProductPage() {
  return (
    <VendorNewProductValidation>
      <VendorNewProductPageClient />
    </VendorNewProductValidation>
  )
}
