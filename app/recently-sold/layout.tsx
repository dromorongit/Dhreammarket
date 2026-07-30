import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recently Sold - Dhream Market',
  description: 'Recently sold products and services on Dhream Market',
  robots: 'noindex, nofollow',
}

export default function RecentlySoldLayout({ children }: { children: React.ReactNode }) {
  return children
}
