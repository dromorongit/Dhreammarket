import { redirect } from 'next/navigation'

export default function HelpCenterPage({ searchParams }: { searchParams: Record<string, string> }) {
  const qs = searchParams.type ? `?type=${searchParams.type}` : ''
  redirect(`/help${qs}`)
}