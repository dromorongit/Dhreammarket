import VendorSubscriptionValidation from './validation'
import VendorSubscriptionClient from './page.client'

export default function VendorSubscriptionPage() {
  return (
    <VendorSubscriptionValidation>
      <VendorSubscriptionClient />
    </VendorSubscriptionValidation>
  )
}