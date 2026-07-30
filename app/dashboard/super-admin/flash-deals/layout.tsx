import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Manage Flash Deals - Dhream Market Admin',
  robots: 'noindex, nofollow',
}

export default function AdminFlashDealsLayout({ children }: { children: React.ReactNode }) {
  return children
}
