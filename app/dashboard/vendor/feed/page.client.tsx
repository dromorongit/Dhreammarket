'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import ImageUpload from '@/components/ImageUpload'
import { SITE_URL } from '@/lib/site-config'

interface FeedPost {
  id: string
  content: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  likesCount: number
  commentsCount: number
}

export default function VendorFeedPageClient() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null)
  const [storeSlug, setStoreSlug] = useState<string | null>(null)

  const fetchStore = useCallback(async () => {
    try {
      const res = await fetch('/api/store')
      if (res.ok) {
        const data = await res.json()
        setStoreSlug(data.store?.slug ?? null)
      }
    } catch {}
  }, [])

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/vendor/feed')
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts || [])
      }
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStore()
    fetchPosts()
  }, [fetchStore, fetchPosts])

  const resetForm = () => {
    setContent('')
    setImageUrl(null)
    setEditingPost(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !imageUrl) return

    try {
      setSubmitting(true)
      const url = editingPost ? `/api/vendor/feed/${editingPost.id}` : '/api/vendor/feed'
      const method = editingPost ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), imageUrl }),
      })

      if (res.ok) {
        resetForm()
        fetchPosts()
      }
    } catch (err) {
      console.error('Error saving post:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (post: FeedPost) => {
    setEditingPost(post)
    setContent(post.content)
    setImageUrl(post.imageUrl)
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return
    try {
      const res = await fetch(`/api/vendor/feed/${postId}`, { method: 'DELETE' })
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      }
    } catch (err) {
      console.error('Error deleting post:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy mb-2">Feed Posts</h1>
            {storeSlug && (
              <p className="text-sm text-slate-500">
                Your store URL:{' '}
                <Link href={`/vendor/${storeSlug}`} className="text-royal-blue hover:underline">
                  {SITE_URL}/vendor/{storeSlug}
                </Link>
              </p>
            )}
          </div>
        </div>

        <Card variant="elevated" className="mb-8">
          <CardHeader>
            <h3 className="text-lg font-semibold text-deep-navy">
              {editingPost ? 'Edit Post' : 'Create New Post'}
            </h3>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue transition-all duration-200"
                  placeholder="What's new with your store?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Image</label>
                <ImageUpload value={imageUrl ? [imageUrl] : []} onChange={(urls) => setImageUrl(urls[0] || null)} folder="products" maxFiles={1} />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={submitting || (!content.trim() && !imageUrl)}>
                  {submitting ? (editingPost ? 'Updating...' : 'Posting...') : (editingPost ? 'Update Post' : 'Post to Feed')}
                </Button>
                {editingPost && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-deep-navy">Your Posts</h2>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading posts...</div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-slate-500">You haven&#39;t posted any updates yet.</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 whitespace-pre-wrap line-clamp-3">{post.content}</p>
                      {post.imageUrl && (
                        <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden mt-3">
                          <Image src={post.imageUrl} alt="Post" className="object-cover w-full h-full" fill sizes="100vw" unoptimized />
                        </div>
                      )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                      <span>{post.likesCount} likes</span>
                      <span>{post.commentsCount} comments</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(post)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} className="text-red-600 hover:text-red-700">
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
