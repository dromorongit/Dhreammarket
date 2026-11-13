import { describe, it, expect } from 'vitest'
import { buildRepeatLines, type RepeatOrderItem, type RepeatProduct } from './repeat-prefill'

const product = (overrides: Partial<RepeatProduct> = {}): RepeatProduct => ({
  id: 'prod_1',
  name: 'Jollof Rice',
  price: 35,
  availableStock: 10,
  ...overrides,
})

describe('buildRepeatLines', () => {
  it('prefills with current prices when prices changed since last order', () => {
    const items: RepeatOrderItem[] = [
      { productId: 'prod_1', productName: 'Jollof Rice', quantity: 2, unitPrice: 30 },
    ]
    const products = [product({ price: 35 })]

    const { lines, skipped } = buildRepeatLines(items, products)

    expect(skipped).toEqual([])
    expect(lines).toEqual([
      {
        productId: 'prod_1',
        variantId: null,
        name: 'Jollof Rice',
        variantLabel: null,
        quantity: 2,
        unitPrice: 35,
        overridden: false,
      },
    ])
  })

  it('skips products that are out of stock', () => {
    const items: RepeatOrderItem[] = [
      { productId: 'prod_1', productName: 'Jollof Rice', quantity: 2, unitPrice: 30 },
      { productId: 'prod_2', productName: 'Waakye', quantity: 1, unitPrice: 25 },
    ]
    const products = [product({ id: 'prod_1', availableStock: 0 }), product({ id: 'prod_2', name: 'Waakye', availableStock: 5 })]

    const { lines, skipped } = buildRepeatLines(items, products)

    expect(skipped).toEqual(['Jollof Rice'])
    expect(lines).toHaveLength(1)
    expect(lines[0].name).toBe('Waakye')
  })

  it('skips products that are missing/deleted', () => {
    const items: RepeatOrderItem[] = [
      { productId: 'prod_gone', productName: 'Old Dish', quantity: 1, unitPrice: 10 },
    ]
    const products = [product()]

    const { lines, skipped } = buildRepeatLines(items, products)

    expect(skipped).toEqual(['Old Dish'])
    expect(lines).toEqual([])
  })

  it('returns empty when there are no last ordered items', () => {
    const { lines, skipped } = buildRepeatLines([], [product()])
    expect(lines).toEqual([])
    expect(skipped).toEqual([])
  })
})
