import VendorAnalyticsValidation from '../validation'
import VendorAnalyticsClient from './page.client'

export default function VendorAnalyticsPage() {
  return (
    <VendorAnalyticsValidation>
      <VendorAnalyticsClient />
    </VendorAnalyticsValidation>
  )
}