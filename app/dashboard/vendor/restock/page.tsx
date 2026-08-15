import VendorRestockValidation from './validation'
import VendorRestockPageClient from './page.client'

export default function VendorRestockPage() {
  return (
    <VendorRestockValidation>
      <VendorRestockPageClient />
    </VendorRestockValidation>
  )
}
