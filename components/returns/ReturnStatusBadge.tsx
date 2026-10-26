import { Badge } from '@/components/Badge'
import { getStatusCopy, statusToneToBadgeVariant } from '@/lib/returns/ui/status-copy'

interface ReturnStatusBadgeProps {
  status: string
  size?: 'sm' | 'md' | 'lg'
}

export function ReturnStatusBadge({ status, size = 'md' }: ReturnStatusBadgeProps) {
  const copy = getStatusCopy(status)
  return (
    <Badge
      variant={statusToneToBadgeVariant(copy.tone)}
      size={size}
      aria-label={`${copy.label}. ${copy.description}`}
    >
      {copy.label}
    </Badge>
  )
}
