import VendorServiceRequestDetailValidation from './validation'
import VendorServiceRequestDetail from './page.client'

export default function VendorServiceRequestDetailPage({ params }: { params: { id: string } }) {
  return (
    <VendorServiceRequestDetailValidation>
      <VendorServiceRequestDetail params={params} />
    </VendorServiceRequestDetailValidation>
  )
}
