import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Marketing Officers - Dhream Market Admin',
  robots: 'noindex, nofollow',
}

export default function MarketingOfficersLayout({ children }: { children: React.ReactNode }) {
  return children
}
