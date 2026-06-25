import { Metadata } from 'next'
import MarketplaceClient from './marketplace-client'

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Browse thousands of products from verified Ghanaian vendors. Shop securely with Paystack in Ghana.',
}

export default async function MarketplacePage() {
  return <MarketplaceClient />
}