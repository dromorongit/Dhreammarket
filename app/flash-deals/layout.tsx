import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Flash Deals - Dhream Market',
  description: 'Limited time flash deals and discounts on Dhream Market',
  robots: 'noindex, nofollow',
}

export default function FlashDealsLayout({ children }: { children: React.ReactNode }) {
  return children
}
