import { getServerSession } from '@/lib/auth'
import { getPrisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { TransitionButton } from './TransitionButton'
import { NewVersionButton } from './new-version-button'
import Link from 'next/link'

const MANAGE_ROLES = ['ADMIN', 'SUPER_ADMIN']

const ALLOWED_TARGETS: Record<string, string[]> = {
  DRAFT: ['APPROVED', 'RETIRED'],
  APPROVED: ['PUBLISHED', 'RETIRED'],
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PUBLISHED: 'bg-green-100 text-green-700',
  RETIRED: 'bg-red-100 text-red-700',
}

export default async function SupportDocsAdminPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/admin/support-docs'))
  }
  if (!MANAGE_ROLES.includes(session.role)) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold mb-2">Support Documents</h1>
        <p className="text-red-600 rounded border border-red-100 bg-red-50 px-3 py-2">
          You are not authorized to manage support documents (ADMIN or SUPER_ADMIN required).
        </p>
      </div>
    )
  }

  const documents = await getPrisma().supportDocument.findMany({
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true, slug: true, title: true, status: true, version: true, intent: true,
      authorId: true, reviewerId: true, approvedAt: true, createdAt: true,
    },
  })

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-1">Support Documents</h1>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <Link
          href="/admin/support-docs/create"
          className="px-4 py-2 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50"
        >
          Create draft
        </Link>
        {documents.length > 0 && (
          <p className="text-xs text-gray-500">
            Review and transition support documents. One active (APPROVED/PUBLISHED) version per intent.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {documents.length === 0 && (
          <div className="col-span-full text-center py-6 rounded border border-gray-200 bg-gray-50 text-gray-500 text-sm">
            No support documents found.
          </div>
        )}
        {documents.map((doc) => (
          <article
            key={doc.id}
            className="rounded border border-gray-200 bg-white p-3 sm:p-4 shadow-sm"
          >
            <header className="flex flex-wrap justify-between items-start gap-2 mb-2">
              <h2 className="font-semibold text-sm sm:text-base truncate">{doc.title}</h2>
              <span
                className={`text-xs font-semibold rounded px-2 py-0.5 uppercase tracking-tighter ${STATUS_BADGE[doc.status] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {doc.status}
              </span>
            </header>
            <ul className="text-xs text-gray-600 space-y-1 mb-3">
              <li><span className="font-medium">Intent:</span> {doc.intent}</li>
              <li><span className="font-medium">Version:</span> {doc.version}</li>
              <li><span className="font-medium">Slug:</span> {doc.slug}</li>
              {doc.authorId && <li><span className="font-medium">Author:</span> {doc.authorId}</li>}
              {doc.reviewerId && <li><span className="font-medium">Reviewer:</span> {doc.reviewerId}</li>}
              {doc.approvedAt && <li><span className="font-medium">Approved:</span> {new Date(doc.approvedAt).toLocaleDateString()}</li>}
            </ul>
            <TransitionButton
              documentId={doc.id}
              currentStatus={doc.status}
              targets={ALLOWED_TARGETS[doc.status] ?? []}
            />
            <NewVersionButton
              documentId={doc.id}
              documentSlug={doc.slug}
              documentTitle={doc.title}
              documentStatus={doc.status}
            />
          </article>
        ))}
      </div>

      {documents.length > 0 && (
        <p className="mt-4 text-xs text-gray-500">
          Approving or publishing retires any other active version for the same intent. An author cannot approve
          their own document unless a SUPER_ADMIN records an AuditLog override.
        </p>
      )}
    </div>
  )
}
