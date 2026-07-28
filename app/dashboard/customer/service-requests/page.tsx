import CustomerServiceRequestsValidation from './validation'
import CustomerServiceRequestsClient from './page.client'

export default function CustomerServiceRequestsPage() {
  return (
    <CustomerServiceRequestsValidation>
      <CustomerServiceRequestsClient />
    </CustomerServiceRequestsValidation>
  )
}