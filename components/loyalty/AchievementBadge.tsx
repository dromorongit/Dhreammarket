'use client'

import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'

interface AchievementBadgeProps {
  name: string
  badge: string | null
  color: string | null
  icon: string | null
  unlocked: boolean
  unlockedAt: string | null
  progress: number
  maxProgress: number
}

export function AchievementBadge({ name, badge, color, icon, unlocked, unlockedAt, progress, maxProgress }: AchievementBadgeProps) {
  return (
    <div
      className={`rounded-lg border p-3 flex items-center gap-3 transition-all ${
        unlocked
          ? 'border-amber-200 bg-amber-50'
          : 'border-gray-200 bg-gray-50 opacity-75'
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
          unlocked ? 'bg-amber-100' : 'bg-gray-200'
        }`}
      >
        {icon ?? (unlocked ? '🏆' : '🔒')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={`font-medium text-sm ${unlocked ? 'text-amber-800' : 'text-gray-500'}`}>
            {name}
          </h4>
          {unlocked && <Badge className="bg-amber-100 text-amber-800 text-xs">Unlocked</Badge>}
        </div>
        {maxProgress > 1 && (
          <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-amber-400 transition-all duration-300"
              style={{ width: `${Math.min((progress / maxProgress) * 100, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}