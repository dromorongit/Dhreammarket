import SuperAdminAdvertisingValidation from './validation'
import SuperAdminAdvertisingClient from './page.client'

export default function SuperAdminAdvertisingPage() {
  return (
    <SuperAdminAdvertisingValidation>
      <SuperAdminAdvertisingClient />
    </SuperAdminAdvertisingValidation>
  )
}
