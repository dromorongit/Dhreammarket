import { isOpenReturnStatus } from './types'

export type OverdueReturn = {
  id: string
  escalationDeadline: Date
  createdAt?: Date
}

function toDate(v: any): Date | null {
  if (v instanceof Date) return v
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

export function isOverdue(request: any, now: Date | string | number = new Date()): boolean {
  const nowDate = now instanceof Date ? now : new Date(now)
  const deadline = toDate(request?.escalationDeadline)
  if (!deadline) return false
  // vendor deadline passed: now > deadline (exact boundary? "passed" means strictly after)
  if (nowDate.getTime() <= deadline.getTime()) return false
  const status = String(request?.status ?? '')
  // awaiting vendor = PENDING (or item in transit/received)
  if (status !== 'PENDING' && status !== 'ITEM_IN_TRANSIT' && status !== 'ITEM_RECEIVED') return false
  return true
}

export function findOverdueReturns(input: any, nowArg?: any): any[] {
  let requests: any[]
  let now: any
  if (Array.isArray(input)) {
    requests = input
    now = nowArg
  } else if (input && typeof input === 'object') {
    requests = input.requests || input.items || input.returnRequests || []
    now = input.now ?? nowArg
  } else {
    requests = []
    now = nowArg
  }
  if (!Array.isArray(requests)) return []
  const nowDate = now instanceof Date ? now : (now === undefined ? new Date() : new Date(now))
  return requests.filter((r) => isOverdue(r, nowDate))
}

export const findOverdueReturnRequests = findOverdueReturns
export const getOverdueReturns = findOverdueReturns
export const listOverdueReturns = findOverdueReturns

/**
 * Pure finder: lists AWAITING_REFUND requests whose linked refund is PROCESSED.
 * Request objects may carry the refund inline as `refund` or `refunds[0]`.
 * No database, no network, no money writes.
 */
export function findSettledReturns(input: any): any[] {
  let requests: any[]
  if (Array.isArray(input)) {
    requests = input
  } else if (input && typeof input === 'object') {
    requests = input.requests || input.items || input.returnRequests || []
  } else {
    requests = []
  }
  if (!Array.isArray(requests)) return []
  return requests.filter((r) => {
    if (r.status !== 'AWAITING_REFUND') return false
    const refund = r.refund ?? (r.refunds && r.refunds[0])
    return Boolean(refund && refund.status === 'PROCESSED')
  })
}

export const findSettledReturnRequests = findSettledReturns
export const getSettledReturns = findSettledReturns
export const listSettledReturns = findSettledReturns