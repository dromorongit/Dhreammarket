import { describe, it, expect } from 'vitest'
import {
  FORBIDDEN_PUBLIC_FIELDS,
  PUBLIC_ORDER_ITEM_SELECT,
  PUBLIC_ORDER_SELECT,
  PUBLIC_PRODUCT_SELECT,
  PUBLIC_VARIANT_SELECT,
  VENDOR_ORDER_ITEM_SELECT,
  VENDOR_ORDER_SELECT,
  findForbiddenCostFields,
} from '@/lib/public-selects'

const SECRET_FIELDS = ['costPrice', 'costPriceSnapshot', 'deliveryCost']

function selectedKeys(spec: Record<string, unknown>): string[] {
  return Object.keys(spec)
}

describe('the public selects hide every cost field', () => {
  it('the product select has no cost price', () => {
    expect(selectedKeys(PUBLIC_PRODUCT_SELECT)).not.toContain('costPrice')
  })

  it('the variant select has no cost price', () => {
    expect(selectedKeys(PUBLIC_VARIANT_SELECT)).not.toContain('costPrice')
  })

  it('the order select has no delivery cost', () => {
    expect(selectedKeys(PUBLIC_ORDER_SELECT)).not.toContain('deliveryCost')
  })

  it('the order item select has no cost snapshot', () => {
    expect(selectedKeys(PUBLIC_ORDER_ITEM_SELECT)).not.toContain('costPriceSnapshot')
  })

  it('the public selects hide the platform money split too', () => {
    for (const spec of [PUBLIC_ORDER_SELECT, PUBLIC_ORDER_ITEM_SELECT]) {
      const keys = selectedKeys(spec)
      for (const secret of [
        'grossAmount',
        'processorFee',
        'netAmount',
        'platformCommission',
        'vendorEarnings',
        'commissionRate',
      ]) {
        expect(keys).not.toContain(secret)
      }
    }
  })

  it('the vendor selects keep the cost fields the vendor is entitled to', () => {
    expect(selectedKeys(VENDOR_ORDER_ITEM_SELECT)).toContain('costPriceSnapshot')
    expect(selectedKeys(VENDOR_ORDER_SELECT)).not.toContain('deliveryCost')
  })
})

describe('findForbiddenCostFields', () => {
  it('finds nothing in a clean payload', () => {
    expect(
      findForbiddenCostFields({
        products: [{ id: 'p1', name: 'Widget', variants: [{ id: 'v1', price: 10 }] }],
      })
    ).toEqual([])
  })

  it('finds a cost price at any depth', () => {
    const found = findForbiddenCostFields({
      products: [{ id: 'p1', variants: [{ id: 'v1', costPrice: 3 }] }],
    })
    expect(found).toEqual(['costPrice'])
  })

  it('finds a cost snapshot and a delivery cost', () => {
    const found = findForbiddenCostFields({
      order: {
        deliveryCost: 5,
        items: [{ id: 'i1', costPriceSnapshot: 4 }],
      },
    })
    expect(found.sort()).toEqual(['costPriceSnapshot', 'deliveryCost'])
  })

  it('finds the same secret under its other names', () => {
    const found = findForbiddenCostFields({
      items: [{ variantCostPrice: 1, productCostPrice: 2 }],
    })
    expect(found.sort()).toEqual(['productCostPrice', 'variantCostPrice'])
  })

  it('lists the fields it guards', () => {
    expect([...FORBIDDEN_PUBLIC_FIELDS].sort()).toEqual([
      'costPrice',
      'costPriceSnapshot',
      'deliveryCost',
    ])
  })
})
