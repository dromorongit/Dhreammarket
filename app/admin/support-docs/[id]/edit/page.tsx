import { getServerSession } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EditDocumentForm } from './edit-form'

const MANAGE_ROLES = ['ADMIN', 'SUPER_ADMIN']

export default async function EditSupportDocumentPage({
  params,
}: { params: { id: string } }) {
  const session = await getServerSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/admin/support-docs'))
  }
  if (!MANAGE_ROLES.includes(session.role)) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold mb-2">Edit support document</h1>
        <p className="text-red-600 rounded border border-red-100 bg-red-50 px-3 py-2">
          You are not authorized to edit support documents (ADMIN or SUPER_ADMIN required).
        </p>
      </div>
    )
  }

  const doc = await getPrisma().supportDocument.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, title: true, content: true, intent: true, status: true },
  })

  if (!doc) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold mb-2">Edit support document</h1>
        <p className="text-red-600 rounded border border-red-100 bg-red-50 px-3 py-2">Support document not found.</p>
      </div>
    )
  }

  if (doc.status !== 'DRAFT') {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold mb-2">Edit support document</h1>
        <p className="text-red-600 rounded border border-red-100 bg-red-50 px-3 py-2">
          {doc.status} documents are immutable. Create a new version instead.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-1">Edit support document</h1>
      <p className="text-sm text-gray-600 mb-4">
        Editing a DRAFT draft. Changes become retrievable only after the document is approved or published again.
      </p>
      <EditDocumentForm document={doc} />
    </div>
  )
}
