import VendorAdvertisingValidation from './validation'
import VendorAdvertisingClient from './page.client'

export default function VendorAdvertisingPage() {
  return (
    <VendorAdvertisingValidation>
      <VendorAdvertisingClient />
    </VendorAdvertisingValidation>
  )
}
