import { Metadata } from 'next'
import ServicesClient from './services-client'

export const metadata: Metadata = {
  title: 'Services Marketplace - Dhream Market',
  description: 'Browse professional services from verified vendors on Dhream Market. Find the perfect service for your needs.',
}

export default async function ServicesPage() {
  return <ServicesClient />
}