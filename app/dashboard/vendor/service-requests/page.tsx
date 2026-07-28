import VendorServiceRequestsValidation from './validation'
import VendorServiceRequestsClient from './page.client'

export default function VendorServiceRequestsPage() {
  return (
    <VendorServiceRequestsValidation>
      <VendorServiceRequestsClient />
    </VendorServiceRequestsValidation>
  )
}