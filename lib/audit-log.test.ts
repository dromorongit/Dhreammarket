import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { logError } from '@/lib/logger'
import { createAuditLog } from '@/lib/audit-log'

const mockGetPrisma = vi.mocked(getPrisma)
const mockLogError = vi.mocked(logError)

describe('createAuditLog null-safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes a record for a null userId and does not throw', async () => {
    let created: any = null
    mockGetPrisma.mockReturnValue({
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          created = data
          return { id: 'audit-1', ...data }
        }),
      },
    } as any)

    await expect(
      createAuditLog({
        userId: null,
        userRole: 'SYSTEM',
        action: 'PAYMENT_CONFIRMED',
        entityType: 'ORDER',
        entityId: 'order-1',
      })
    ).resolves.toBeUndefined()

    expect(created.userId).toBeNull()
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('writes a record for a string userId as before', async () => {
    let created: any = null
    mockGetPrisma.mockReturnValue({
      auditLog: {
        create: vi.fn(async ({ data }: any) => {
          created = data
          return { id: 'audit-1', ...data }
        }),
      },
    } as any)

    await expect(
      createAuditLog({
        userId: 'user-1',
        userRole: 'CUSTOMER',
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: 'order-1',
      })
    ).resolves.toBeUndefined()

    expect(created.userId).toBe('user-1')
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('reports a failing audit write but does not throw', async () => {
    const error = new Error('db write failed')
    mockGetPrisma.mockReturnValue({
      auditLog: {
        create: vi.fn(async () => {
          throw error
        }),
      },
    } as any)

    await expect(
      createAuditLog({
        userId: null,
        userRole: 'SYSTEM',
        action: 'PAYMENT_FAILED',
        entityType: 'ORDER',
        entityId: 'order-1',
      })
    ).resolves.toBeUndefined()

    expect(mockLogError).toHaveBeenCalled()
  })
})
