export function isReturnsFlowEnabled(): boolean {
  const value = process.env.RETURNS_FLOW_ENABLED
  if (value === undefined || value === null) return false
  return value.trim().toLowerCase() === 'true'
}

let returnWindowDaysWarned = false

export function getReturnWindowDays(): number {
  const value = process.env.RETURN_WINDOW_DAYS
  if (value === undefined || value === null || value.trim() === '') return 7
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 60) {
    if (!returnWindowDaysWarned) {
      returnWindowDaysWarned = true
      console.warn(`RETURN_WINDOW_DAYS invalid ("${value}"); falling back to 7`)
    }
    return 7
  }
  return parsed
}

let vendorResponseHoursWarned = false

export function getVendorResponseHours(): number {
  const value = process.env.VENDOR_RESPONSE_HOURS
  if (value === undefined || value === null || value.trim() === '') return 72
  const parsed = Number(value.trim())
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 720) {
    if (!vendorResponseHoursWarned) {
      vendorResponseHoursWarned = true
      console.warn(`VENDOR_RESPONSE_HOURS invalid ("${value}"); falling back to 72`)
    }
    return 72
  }
  return parsed
}
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
