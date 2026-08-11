'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { BlogArticle } from '@/lib/blog-content'

interface BlogArticleModalProps {
  article: BlogArticle | null
  onClose: () => void
}

export default function BlogArticleModal({ article, onClose }: BlogArticleModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!article) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [article, onClose])

  if (!article) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {article.readTime}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
            aria-label="Close article"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="relative aspect-[16/9] bg-slate-100">
          <Image
            src={article.coverImage}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
            fill
            priority
          />
        </div>
        <div className="px-6 py-8 md:px-10 md:py-10">
          <h1 className="text-2xl md:text-3xl font-bold text-deep-navy mb-6 leading-tight">
            {article.title}
          </h1>
          <div className="space-y-5 text-slate-700 leading-relaxed">
            {article.content.map((block, idx) =>
              block.type === 'heading' ? (
                <h2 key={idx} className="text-lg md:text-xl font-semibold text-deep-navy pt-2">
                  {block.text}
                </h2>
              ) : (
                <p key={idx} className="text-sm md:text-base">
                  {block.text}
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
