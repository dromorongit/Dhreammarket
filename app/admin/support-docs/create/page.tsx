import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CreateDocumentForm } from '../create-form'

const MANAGE_ROLES = ['ADMIN', 'SUPER_ADMIN']

export default async function CreateSupportDocumentPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/admin/support-docs/create'))
  }
  if (!MANAGE_ROLES.includes(session.role)) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold mb-2">Create support document</h1>
        <p className="text-red-600 rounded border border-red-100 bg-red-50 px-3 py-2">
          You are not authorized to create support documents (ADMIN or SUPER_ADMIN required).
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-1">Create support document</h1>
      <p className="text-sm text-gray-600 mb-4">
        Create a new DRAFT support document. It becomes retrievable only after an ADMIN or SUPER_ADMIN approves
        or publishes it.
      </p>
      <CreateDocumentForm />
    </div>
  )
}
