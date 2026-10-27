import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { ReturnsFlowProvider } from '@/components/returns/ReturnsFlowProvider'

export default function CustomerOrderDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isEnabled = isReturnsFlowEnabled()
  return <ReturnsFlowProvider enabled={isEnabled}>{children}</ReturnsFlowProvider>
}
