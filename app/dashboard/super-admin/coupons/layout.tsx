import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Manage Coupons - Dhream Market Admin',
  robots: 'noindex, nofollow',
}

export default function AdminCouponsLayout({ children }: { children: React.ReactNode }) {
  return children
}
