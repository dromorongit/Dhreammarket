'use client'

import { useState } from 'react'
import Image from 'next/image'
import { BlogArticle } from '@/lib/blog-content'
import { getBlurDataURL, CARD_IMAGE_SIZES_3COL } from '@/lib/image-utils'

interface BlogTeaserSectionProps {
  articles: BlogArticle[]
  onSelect: (article: BlogArticle) => void
}

export default function BlogTeaserSection({ articles, onSelect }: BlogTeaserSectionProps) {
  return (
    <section className="relative py-10 lg:py-14 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-deep-navy mb-4">
            Guides &amp; Tips
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Everything you need to shop and sell with confidence
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => onSelect(article)}
              className="group text-left bg-white rounded-2xl border border-slate-200 hover:border-gold/50 hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
                <Image
                  src={article.coverImage}
                  alt={article.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  fill
                  sizes={CARD_IMAGE_SIZES_3COL}
                  placeholder="blur"
                  blurDataURL={getBlurDataURL()}
                  loading="lazy"
                />
              </div>
              <div className="p-5 space-y-2">
                <span className="text-[11px] font-semibold text-royal-blue uppercase tracking-wider">
                  {article.readTime}
                </span>
                <h3 className="text-base font-bold text-deep-navy group-hover:text-royal-blue transition-colors line-clamp-2 leading-snug">
                  {article.title}
                </h3>
                <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {article.excerpt}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
