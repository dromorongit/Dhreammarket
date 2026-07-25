import AdminDashboardValidation from './validation'
import AdminDashboardClient from './page.client'

export default function AdminDashboardPage() {
  return (
    <AdminDashboardValidation>
      <AdminDashboardClient />
    </AdminDashboardValidation>
  )
}