export function isEmailServiceEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_EMAIL_SERVICE_ENABLED
  if (value === undefined || value === null) return false
  return value.toLowerCase() === 'true'
}

export function isLedgerShadowWriteEnabled(): boolean {
  const value = process.env.LEDGER_SHADOW_WRITE
  if (value === undefined || value === null) return false
  return value.toLowerCase() === 'true'
}

export type PayoutLedgerMode = 'off' | 'compare' | 'enforce'

export function getPayoutLedgerMode(): PayoutLedgerMode {
  const value = process.env.PAYOUT_LEDGER_MODE
  if (value === undefined || value === null) return 'off'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'compare') return 'compare'
  if (normalized === 'enforce') return 'enforce'
  return 'off'
}

let holdDaysWarned = false

export function getPayoutHoldDays(): number {
  const value = process.env.PAYOUT_HOLD_DAYS
  if (value === undefined || value === null || value.trim() === '') return 7
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 90) {
    if (!holdDaysWarned) {
      holdDaysWarned = true
      console.warn(`PAYOUT_HOLD_DAYS invalid ("${value}"); falling back to 7`)
    }
    return 7
  }
  return parsed
}
