import VendorServicesValidation from './validation'
import VendorServicesPageClient from './page.client'

export default function VendorServicesPage() {
  return (
    <VendorServicesValidation>
      <VendorServicesPageClient />
    </VendorServicesValidation>
  )
}
