import VendorFeedPageClient from './page.client'
import VendorFeedValidation from './validation'

export default function VendorFeedPage() {
  return (
    <VendorFeedValidation>
      <VendorFeedPageClient />
    </VendorFeedValidation>
  )
}
