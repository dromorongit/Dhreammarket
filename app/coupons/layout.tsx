import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Coupons & Deals - Dhream Market',
  description: 'Find the latest coupons and deals on Dhream Market',
}

export default function CouponsLayout({ children }: { children: React.ReactNode }) {
  return children
}
