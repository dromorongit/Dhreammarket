import VendorDashboardValidation from './validation'

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <VendorDashboardValidation>
      {children}
    </VendorDashboardValidation>
  )
}
