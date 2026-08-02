import SuperAdminSubscriptionValidation from './validation'
import SuperAdminSubscriptionClient from './page.client'

export default function SuperAdminSubscriptionPage() {
  return (
    <SuperAdminSubscriptionValidation>
      <SuperAdminSubscriptionClient />
    </SuperAdminSubscriptionValidation>
  )
}