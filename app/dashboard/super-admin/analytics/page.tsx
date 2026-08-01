import SuperAdminAnalyticsValidation from '../validation'
import SuperAdminAnalyticsClient from './page.client'

export default function SuperAdminAnalyticsPage() {
  return (
    <SuperAdminAnalyticsValidation>
      <SuperAdminAnalyticsClient />
    </SuperAdminAnalyticsValidation>
  )
}