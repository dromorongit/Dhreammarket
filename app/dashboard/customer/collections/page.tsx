import { CollectionsGrid } from '@/components/CollectionsGrid'

export default function CollectionsListPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-deep-navy">My Collections</h1>
        </div>
        <CollectionsGrid />
      </div>
    </div>
  )
}