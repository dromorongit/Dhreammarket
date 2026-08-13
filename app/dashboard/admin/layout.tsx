import { redirect } from 'next/navigation'
import AdminDashboardValidation from './validation'

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminDashboardValidation>{children}</AdminDashboardValidation>
}
