'use client'

import { Button } from '@/components/Button'
import { Card, CardContent } from '@/components/Card'

interface ReturnConfirmStepProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  sending: boolean
}

export function ReturnConfirmStep({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  sending,
}: ReturnConfirmStepProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      <Card className="w-full max-w-md bg-white" role="dialog" aria-modal="true">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-deep-navy">{title}</h2>
          <p className="text-slate-600 mb-6">{description}</p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onCancel} disabled={sending}>
              {cancelLabel}
            </Button>
            <Button onClick={onConfirm} disabled={sending}>
              {sending ? 'Working...' : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
