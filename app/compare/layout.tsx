import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compare Products - Dhream Market',
  description: 'Compare products side by side on Dhream Market',
  robots: 'noindex, nofollow',
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children
}
