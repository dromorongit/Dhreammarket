import type { Metadata } from 'next'
import FAQClient from './faq-client'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Find answers to frequently asked questions about Dhream Market. Get help with orders, vendors, payments, and more.',
}

export default function FAQPage() {
  return <FAQClient />
}
