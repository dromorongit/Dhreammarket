import VendorDashboardValidation from './validation'
import VendorDashboardClient from './page.client'

export default function VendorDashboardPage() {
  return (
    <VendorDashboardValidation>
      <VendorDashboardClient />
    </VendorDashboardValidation>
  )
}
