import VendorVerificationValidation from './validation'
import VendorVerificationPageClient from './page.client'

export default function VendorVerificationPage() {
  return (
    <VendorVerificationValidation>
      <VendorVerificationPageClient />
    </VendorVerificationValidation>
  )
}
