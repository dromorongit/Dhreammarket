import type { Metadata } from 'next'
import HelpClient from './help-client'
import { getBrandingPreferences } from '@/lib/platform-preferences'

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Find guides, FAQs, and support for Dhream Market. Get help with orders, vendors, payments, and account issues.',
}

export default async function HelpPage() {
  const branding = await getBrandingPreferences()
  const supportPhone = branding.supportPhone || '+233 59 652 2239'
  return <HelpClient />
}

