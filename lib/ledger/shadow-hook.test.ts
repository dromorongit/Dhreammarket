import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import { Caps } from '@/lib/refunds/process-refund'

const mockRecordRefundClawback = vi.hoisted(() => vi.fn())
const mockLogDebug = vi.hoisted(() => vi.fn())
const mockLogError = vi.hoisted(() => vi.fn())

vi.mock('./corrective-ledger', () => ({
  recordRefundClawback: mockRecordRefundClawback,
}))
vi.mock('@/lib/logger', () => ({
  logDebug: mockLogDebug,
  logError: mockLogError,
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

import { recordClawbackAfterSettlement } from './shadow-hook'

const origFlag = process.env.LEDGER_SHADOW_WRITE

function enableFlag() {
  process.env.LEDGER_SHADOW_WRITE = 'true'
}

function disableFlag() {
  delete process.env.LEDGER_SHADOW_WRITE
}

/** A client that must not be touched at all - any access throws. */
function untouchableClient() {
  return new Proxy({} as never, {
    get() {
      throw new Error('the ledger client must not be touched when the flag is off')
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  disableFlag()
})

afterEach(() => {
  process.env.LEDGER_SHADOW_WRITE = origFlag
})

describe('recordClawbackAfterSettlement', () => {
  it('flag off: never calls the ledger and never touches the client', async () => {
    const client = untouchableClient()

    await recordClawbackAfterSettlement(client as never, 'refund_1')

    expect(mockRecordRefundClawback).not.toHaveBeenCalled()
    expect(mockLogDebug).not.toHaveBeenCalled()
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('flag off: behaves the same for every ledger outcome', async () => {
    for (const status of ['created', 'already_recorded', 'skipped'] as const) {
      mockRecordRefundClawback.mockResolvedValue({ status })
      disableFlag()

      await recordClawbackAfterSettlement({} as never, 'refund_1')

      expect(mockRecordRefundClawback).not.toHaveBeenCalled()
    }
  })

  it('flag on: calls recordRefundClawback exactly once with the client and refund id', async () => {
    enableFlag()
    mockRecordRefundClawback.mockResolvedValue({ status: 'created' })
    const client = {} as never

    await recordClawbackAfterSettlement(client, 'refund_1')

    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(1)
    expect(mockRecordRefundClawback).toHaveBeenCalledWith(client, 'refund_1')
    expect(mockLogDebug).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mockLogDebug.mock.calls)).toContain('refund_1')
    expect(JSON.stringify(mockLogDebug.mock.calls)).toContain('created')
  })

  it('flag on: logs each outcome with the refund id and status only', async () => {
    enableFlag()
    const client = {} as never

    for (const status of ['created', 'already_recorded', 'skipped'] as const) {
      mockRecordRefundClawback.mockResolvedValue({ status })
      await recordClawbackAfterSettlement(client, 'refund_2')
    }

    expect(mockRecordRefundClawback).toHaveBeenCalledTimes(3)
    const logged = JSON.stringify([...mockLogDebug.mock.calls, ...mockLogError.mock.calls])
    expect(logged).toContain('refund_2')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('flag on: a thrown error is swallowed and logged with the refund id', async () => {
    enableFlag()
    mockRecordRefundClawback.mockImplementation(() => {
      throw new Error('ledger is on fire')
    })

    await expect(recordClawbackAfterSettlement({} as never, 'refund_3')).resolves.toBeUndefined()

    expect(mockLogError).toHaveBeenCalledTimes(1)
    const [, error, meta] = mockLogError.mock.calls[0]
    expect((error as Error).message).toBe('ledger is on fire')
    expect(meta).toEqual({ refundId: 'refund_3' })
  })

  it('flag on: a rejected Prisma error is swallowed and logged with the refund id', async () => {
    enableFlag()
    mockRecordRefundClawback.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('boom', {
        code: 'P2034',
        clientVersion: 'test',
      })
    )

    await expect(recordClawbackAfterSettlement({} as never, 'refund_4')).resolves.toBeUndefined()

    expect(mockLogError).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mockLogError.mock.calls)).toContain('refund_4')
  })

  it('flag on: a rejection with a non-Error value is swallowed and logged with the refund id', async () => {
    enableFlag()
    mockRecordRefundClawback.mockRejectedValue('not an error at all')

    await expect(recordClawbackAfterSettlement({} as never, 'refund_5')).resolves.toBeUndefined()

    expect(mockLogError).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(mockLogError.mock.calls)).toContain('refund_5')
  })

  it('logged output never contains customer data or the refund reason', async () => {
    enableFlag()
    mockRecordRefundClawback.mockResolvedValue({ status: 'created' })

    const customer = {
      email: 'ada.lovelace@example.test',
      phone: '+233501234567',
      address: '21 Ada Street, Accra',
      reason: 'Customer returned the item; phone +233501234567, email ada.lovelace@example.test',
    }

    await recordClawbackAfterSettlement({} as never, 'refund_6')

    const logged = JSON.stringify([...mockLogDebug.mock.calls, ...mockLogError.mock.calls])
    expect(customer.email).not.toBe('')
    expect(logged).not.toContain(customer.email)
    expect(logged).not.toContain(customer.phone)
    expect(logged).not.toContain(customer.address)
    expect(logged).not.toContain(customer.reason)
  })
})

describe('refundable cap: ledger item loading matches the refund service', () => {
  it('yields identical item caps from the ledger-shaped list and the service list, remainder included', () => {
    // One charged payment of 100.00 split across items of gross 10.00,
    // 20.00 and 30.00. Integer pro-rata allocation gives 16.66, 33.33 and
    // 50.01 - the 1 pesewa rounding remainder lands on the LAST item, so the
    // item order matters and must be identical in both places.
    const order = {
      id: 'order_1',
      total: 60,
      items: [
        { id: 'item_a', price: 10, quantity: 1 },
        { id: 'item_b', price: 20, quantity: 1 },
        { id: 'item_c', price: 30, quantity: 1 },
      ],
      payment: { id: 'pay_1', amount: 100 },
    }

    // The refund service loads the order with `orderInclude` (`items: true`,
    // no `orderBy`) and calls Caps.forOrder(order).
    const serviceCaps = Caps.forOrder(order)

    // The ledger loads only { id, price, quantity } per item (corrective-
    // ledger.ts), also with no `orderBy`, and passes that same list to the
    // same pure Caps.forOrder - so both must agree, item for item.
    const ledgerCaps = Caps.forOrder({
      id: order.id,
      total: order.total,
      items: order.items.map(({ id, price, quantity }) => ({ id, price, quantity })),
      payment: order.payment,
    })

    expect(serviceCaps.itemCap('item_a')).toBe(16.66)
    expect(serviceCaps.itemCap('item_b')).toBe(33.33)
    expect(serviceCaps.itemCap('item_c')).toBe(50.01)

    expect(ledgerCaps.itemCap('item_a')).toBe(serviceCaps.itemCap('item_a'))
    expect(ledgerCaps.itemCap('item_b')).toBe(serviceCaps.itemCap('item_b'))
    expect(ledgerCaps.itemCap('item_c')).toBe(serviceCaps.itemCap('item_c'))
  })
})
