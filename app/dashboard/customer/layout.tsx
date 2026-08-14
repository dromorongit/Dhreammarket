import CustomerDashboardValidation from './validation'

export default async function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CustomerDashboardValidation>
      {children}
    </CustomerDashboardValidation>
  )
}