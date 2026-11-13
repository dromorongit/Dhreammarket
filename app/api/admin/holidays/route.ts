import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { getPolicy } from '@/lib/delivery'
import { createAuditLog } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDateString(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === value
}

function sortedUnique(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort()
}

export async function GET(request: NextRequest) {
  const authCheck = await requireSuperAdmin()
  if (authCheck instanceof NextResponse) {
    return authCheck
  }

  const policy = await getPolicy()
  return NextResponse.json({ holidayList: policy.holidayList ?? [] })
}

export async function POST(request: NextRequest) {
  const authCheck = await requireSuperAdmin()
  if (authCheck instanceof NextResponse) {
    return authCheck
  }

  let body: { date?: unknown; action?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const action = typeof body.action === 'string' ? body.action : ''

  if (!isValidDateString(date)) {
    return NextResponse.json({ error: 'date must be a valid YYYY-MM-DD date' }, { status: 400 })
  }
  if (action !== 'add' && action !== 'remove') {
    return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 })
  }

  const prisma = getPrisma()
  const policy = await getPolicy()
  const current = sortedUnique(policy.holidayList ?? [])
  const alreadyPresent = current.includes(date)

  let next: string[]
  if (action === 'add') {
    if (alreadyPresent) {
      return NextResponse.json({ error: 'date is already a holiday' }, { status: 400 })
    }
    next = sortedUnique([...current, date])
  } else {
    if (!alreadyPresent) {
      return NextResponse.json({ error: 'date is not a holiday' }, { status: 400 })
    }
    next = current.filter((d) => d !== date)
  }

  const changed = JSON.stringify(next) !== JSON.stringify(current)

  await prisma.platformPolicy.update({
    where: { id: 'singleton' },
    data: { holidayList: next },
  })

  if (changed) {
    await createAuditLog({
      userId: authCheck.userId,
      userRole: authCheck.role,
      action: 'HOLIDAY_LIST_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'holiday-list',
      beforeData: { holidayList: current },
      afterData: { holidayList: next },
    })
  }

  return NextResponse.json({ holidayList: next, changed })
}
