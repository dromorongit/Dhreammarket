import type { Metadata } from 'next'
import HelpClient from './help-client'

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Find guides, FAQs, and support for Dhream Market. Get help with orders, vendors, payments, and account issues.',
}

export default function HelpPage() {
  return <HelpClient />
}