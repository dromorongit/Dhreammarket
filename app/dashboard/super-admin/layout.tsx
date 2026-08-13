import { redirect } from 'next/navigation'
import SuperAdminDashboardValidation from './validation'

export default function SuperAdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <SuperAdminDashboardValidation>{children}</SuperAdminDashboardValidation>
}
