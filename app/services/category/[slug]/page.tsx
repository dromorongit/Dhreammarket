import { Metadata } from 'next'
import CategoryClient from './category-client'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await fetch(`https://www.dhreamarket.com/api/service-categories`).then(r => r.json()).catch(() => null)
  const cat = category?.categories?.find((c: any) => c.slug === params.slug)

  const title = cat?.name ? `${cat.name} Services - Dhream Market` : 'Services - Dhream Market'
  const description = cat?.description || 'Browse professional services from verified vendors on Dhream Market.'

  return {
    title,
    description,
    alternates: { canonical: `/services/category/${params.slug}` },
    openGraph: {
      title,
      description,
      url: `${process.env.SITE_URL || 'https://www.dhreamarket.com'}/services/category/${params.slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function CategoryPage({ params }: Props) {
  return <CategoryClient params={params} />
}