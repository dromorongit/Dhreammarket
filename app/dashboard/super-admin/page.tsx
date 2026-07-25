import SuperAdminDashboardValidation from './validation'
import SuperAdminDashboardClient from './page.client'

export default function SuperAdminDashboardPage() {
  return (
    <SuperAdminDashboardValidation>
      <SuperAdminDashboardClient />
    </SuperAdminDashboardValidation>
  )
}