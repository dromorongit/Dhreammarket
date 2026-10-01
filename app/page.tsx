import { Metadata } from 'next'
import { SITE_URL } from '@/lib/site-config'
import HomeClient from '@/components/home/HomeClient'

export const metadata: Metadata = {
  title: 'Dhream Market — The Trusted Home of Ghanaian Trade Online',
  description: 'Shop from verified Ghanaian vendors and pay securely with Paystack. Dhream Market makes online buying and selling in Ghana safe, simple, and fair.',
  alternates: {
    canonical: `${SITE_URL}/`,
  },
}

export default function HomePage() {
  return <HomeClient />
}
