'use client'

import { Card, CardContent, CardHeader } from '@/components/Card'

interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export default function SettingsSection({ title, description, children, className }: SettingsSectionProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <h2 className="text-xl font-semibold text-deep-navy">{title}</h2>
        {description && <p className="text-slate-600 text-sm mt-1">{description}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
