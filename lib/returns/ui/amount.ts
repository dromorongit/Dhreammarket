export type AmountErrorCode = 'EMPTY' | 'NOT_A_NUMBER' | 'TOO_MANY_DECIMALS' | 'NOT_POSITIVE' | 'ABOVE_MAX'

export interface AmountError {
  code: AmountErrorCode
  message: string
}

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/

export interface ParseAmountResultOk { kind: 'ok'; pesewas: number }
export interface ParseAmountResultErr { kind: 'err'; error: AmountError }
export type ParseAmountResult = ParseAmountResultOk | ParseAmountResultErr

export function parseAmountToPesewas(input: string, maxPesewas?: number): ParseAmountResult {
  const trimmed = input.trim()

  if (trimmed === '') {
    return { kind: 'err', error: { code: 'EMPTY', message: 'Enter an amount' } }
  }

  if (trimmed.includes('-') || trimmed.includes('+')) {
    return { kind: 'err', error: { code: 'NOT_POSITIVE', message: 'Amount must be positive' } }
  }

  if (/[eE]/.test(trimmed)) {
    return { kind: 'err', error: { code: 'NOT_A_NUMBER', message: 'Enter a valid amount' } }
  }

  if (/^\d+\.\d{3,}$/.test(trimmed)) {
    return { kind: 'err', error: { code: 'TOO_MANY_DECIMALS', message: 'Amount must have at most two decimal places' } }
  }

  if (!DECIMAL_PATTERN.test(trimmed)) {
    return { kind: 'err', error: { code: 'NOT_A_NUMBER', message: 'Enter a valid amount' } }
  }

  const [whole, fraction] = trimmed.split('.')
  const decimalPart = (fraction ?? '').padEnd(2, '0')
  let pesewas = BigInt(whole) * BigInt(100) + BigInt(decimalPart)

  if (pesewas <= BigInt(0)) {
    return { kind: 'err', error: { code: 'NOT_POSITIVE', message: 'Amount must be greater than zero' } }
  }

  if (maxPesewas !== undefined && pesewas > BigInt(maxPesewas)) {
    return { kind: 'err', error: { code: 'ABOVE_MAX', message: 'Amount is more than the maximum refundable' } }
  }

  return { kind: 'ok', pesewas: Number(pesewas) }
}

export function formatGhs(value: string | number): string {
  const numeric = typeof value === 'string' ? Number(value.replace(/,/g, '')) : value
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(numeric)
}

export function comparePesewas(a: number, b: number): -1 | 0 | 1 {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

export function gtePesewas(a: number, b: number): boolean {
  return a >= b
}

export function ltPesewas(a: number, b: number): boolean {
  return a < b
}

export function pesewasToGhsString(pesewas: number): string {
  const whole = Math.floor(pesewas / 100)
  const cents = pesewas % 100
  return `${whole}.${String(cents).padStart(2, '0')}`
}
