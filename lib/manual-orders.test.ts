import { describe, it, expect } from 'vitest'
import {
  toPesewas,
  fromPesewas,
  validateUnitPrice,
  validateDeliveryFee,
  validateQuantity,
  validateChannel,
  validateIdempotencyKey,
  computeOrderTotals,
  generateReceiptToken,
  buildReceiptUrl,
  buildWhatsAppShareLink,
  normalizeCustomerPhone,
  splitCustomerName,
  orderDisplayNumber,
  type ResolvedManualOrderLine,
} from '@/lib/manual-orders'

describe('lib/manual-orders pesewa math', () => {
  it('converts cedis to pesewas and back', () => {
    expect(toPesewas(123.45)).toBe(12345)
    expect(toPesewas(0.29)).toBe(29)
    expect(fromPesewas(12345)).toBe(123.45)
    expect(fromPesewas(29)).toBe(0.29)
  })

  it('rejects non-finite, non-positive and >2-decimal unit prices', () => {
    expect((validateUnitPrice(10) as { pesewas: number }).pesewas).toBe(1000)
    expect((validateUnitPrice(0.29) as { pesewas: number }).pesewas).toBe(29)
    expect((validateUnitPrice(0.123) as { error: string }).error).toContain('2 decimal places')
    expect((validateUnitPrice(-5) as { error: string }).error).toContain('greater than 0')
    expect((validateUnitPrice(0) as { error: string }).error).toContain('greater than 0')
    expect((validateUnitPrice('10' as unknown as number) as { error: string }).error).toContain('finite number')
    expect((validateUnitPrice(NaN) as { error: string }).error).toContain('finite number')
    expect((validateUnitPrice(Infinity) as { error: string }).error).toContain('finite number')
  })

  it('validates delivery fees', () => {
    expect((validateDeliveryFee(0) as { pesewas: number }).pesewas).toBe(0)
    expect((validateDeliveryFee(12.5) as { pesewas: number }).pesewas).toBe(1250)
    expect((validateDeliveryFee(undefined) as { pesewas: number }).pesewas).toBe(0)
    expect((validateDeliveryFee(-1) as { error: string }).error).toContain('>= 0')
    expect((validateDeliveryFee(1.234) as { error: string }).error).toContain('2 decimal places')
  })

  it('validates quantities', () => {
    expect((validateQuantity(1) as { quantity: number }).quantity).toBe(1)
    expect((validateQuantity(1000) as { quantity: number }).quantity).toBe(1000)
    expect((validateQuantity(0) as { error: string }).error).toContain('between 1 and 1000')
    expect((validateQuantity(1001) as { error: string }).error).toContain('between 1 and 1000')
    expect((validateQuantity(2.5) as { error: string }).error).toContain('integer')
    expect((validateQuantity('5' as unknown as number) as { error: string }).error).toContain('integer')
  })

  it('validates channels', () => {
    expect((validateChannel('WHATSAPP') as { channel: string }).channel).toBe('WHATSAPP')
    expect((validateChannel('WALK_IN') as { channel: string }).channel).toBe('WALK_IN')
    expect((validateChannel('ONLINE' as any) as { error: string }).error).toContain('must be one of')
    expect((validateChannel(123 as any) as { error: string }).error).toContain('must be one of')
  })

  it('validates idempotency keys', () => {
    expect((validateIdempotencyKey('abc-123') as { idempotencyKey: string }).idempotencyKey).toBe('abc-123')
    expect((validateIdempotencyKey('') as { error: string }).error).toContain('required')
    expect((validateIdempotencyKey(null) as { error: string }).error).toContain('required')
  })

  it('computes order totals in pesewas', () => {
    const lines: ResolvedManualOrderLine[] = [
      { productId: 'p1', variantId: null, quantity: 2, unitPricePesewas: 1500, overridden: false },
      { productId: 'p2', variantId: 'v1', quantity: 3, unitPricePesewas: 700, overridden: true },
    ]
    const totals = computeOrderTotals(lines, 1000)
    expect(totals.subtotalPesewas).toBe(2 * 1500 + 3 * 700) // 5100
    expect(totals.shippingPesewas).toBe(1000)
    expect(totals.totalPesewas).toBe(6100)
    expect(totals.subtotal).toBe(51)
    expect(totals.shipping).toBe(10)
    expect(totals.total).toBe(61)
  })
})

describe('lib/manual-orders receipts and links', () => {
  it('generates a 32-char hex receipt token', () => {
    const token = generateReceiptToken()
    expect(token.length).toBe(32)
    expect(/^[0-9a-f]{32}$/.test(token)).toBe(true)
  })

  it('builds receipt URL from public app URL without logging it', () => {
    const url = buildReceiptUrl('abcdef1234567890abcdef1234567890')
    expect(url.endsWith('/receipt/abcdef1234567890abcdef1234567890')).toBe(true)
    expect(url).toContain('receipt/')
  })

  it('builds wa.me share link with encoded receipt URL', () => {
    const link = buildWhatsAppShareLink('0242222222', 'https://example.com/r/xyz')
    expect(link).toBe('https://wa.me/233242222222?text=' + encodeURIComponent('Your Dhreamarket receipt: https://example.com/r/xyz'))
  })

  it('builds wa.me link from 233 and +233 input', () => {
    const a = buildWhatsAppShareLink('+233242222222', 'https://example.com/r/xyz')
    const b = buildWhatsAppShareLink('233242222222', 'https://example.com/r/xyz')
    expect(a).toBe(b)
  })
})

describe('lib/manual-orders phone and name helpers', () => {
  it('normalizes phone formats to one customer identity', () => {
    expect((normalizeCustomerPhone('0242222222') as { phone: string }).phone).toBe('+233242222222')
    expect((normalizeCustomerPhone('233242222222') as { phone: string }).phone).toBe('+233242222222')
    expect((normalizeCustomerPhone('+233242222222') as { phone: string }).phone).toBe('+233242222222')
    expect((normalizeCustomerPhone(' 024 222 2222 ') as { phone: string }).phone).toBe('+233242222222')
  })

  it('rejects invalid phones', () => {
    expect((normalizeCustomerPhone('') as { error: string }).error).toContain('phone is required')
    expect((normalizeCustomerPhone('123') as { error: string }).error).toContain('Ghanaian')
    expect((normalizeCustomerPhone(null as unknown as string) as { error: string }).error).toContain('phone is required')
  })

  it('splits customer names', () => {
    expect(splitCustomerName('Kwame')).toEqual({ firstName: 'Kwame', lastName: null })
    expect(splitCustomerName('Kwame Nkrumah')).toEqual({ firstName: 'Kwame', lastName: 'Nkrumah' })
    expect(splitCustomerName('  Mary  Esi  ')).toEqual({ firstName: 'Mary', lastName: 'Esi' })
  })

  it('derives display number from order id', () => {
    expect(orderDisplayNumber('ord_abc12345def67890')).toBe('DEF67890')
  })
})
