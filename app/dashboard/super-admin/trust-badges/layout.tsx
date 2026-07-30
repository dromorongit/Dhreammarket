import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Manage Trust Badges - Dhream Market Admin',
  robots: 'noindex, nofollow',
}

export default function AdminTrustBadgesLayout({ children }: { children: React.ReactNode }) {
  return children
}
