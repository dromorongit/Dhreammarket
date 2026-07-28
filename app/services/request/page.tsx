import { Metadata } from 'next'
import ServiceRequestForm from './service-request-form'

export const metadata: Metadata = {
  title: 'Request a Service - Dhream Market',
  description: 'Request a professional service from verified vendors on Dhream Market.',
}

export default function ServiceRequestPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Request a Service</h1>
        <p className="text-slate-600 mb-8">Describe your project and send a service request to verified vendors.</p>
        <ServiceRequestForm />
      </div>
    </main>
  )
}