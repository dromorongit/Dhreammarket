import CustomerDashboardValidation from './validation'
import CustomerDashboardClient from './page.client'

export default function CustomerDashboardPage() {
  return (
    <CustomerDashboardValidation>
      <CustomerDashboardClient />
    </CustomerDashboardValidation>
  )
}
