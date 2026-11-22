import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getPrisma } from '@/lib/prisma'

const dbUrl = process.env.DATABASE_URL || ''
if (!dbUrl || /rlwy\.net|railway/i.test(dbUrl) || !/localhost|127\.0\.0\.1/.test(dbUrl)) {
  throw new Error('Refusing to run DB tests against non-local DATABASE_URL')
}

const prisma = getPrisma()

// LEGACY_CUTOFF mirrors the deploy-date cutoff read from
// platform_policy.systemCutoverTimestamp by the trigger (shared with metric code).
const LEGACY_CUTOFF = new Date('2026-01-01T00:00:00.000Z')

const TEST_STORE_ID = 'test_store_sla'
const TEST_USER_ID = 'test_user_sla'

async function cleanup() {
  await prisma.sLADeadlineAudit.deleteMany({ where: { order: { userId: TEST_USER_ID } } })
  await prisma.orderItem.deleteMany({ where: { order: { userId: TEST_USER_ID } } })
  await prisma.order.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.payment.deleteMany({ where: { userId: TEST_USER_ID } })
  await prisma.store.deleteMany({ where: { id: TEST_STORE_ID } })
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })
}

async function setup() {
  await cleanup()
  const user = await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: 'sla-test@example.com',
      password: 'hashed',
      role: 'VENDOR',
    },
  })
  const store = await prisma.store.create({
    data: {
      id: TEST_STORE_ID,
      userId: TEST_USER_ID,
      name: 'SLA Test Store',
      slug: 'sla-test-store',
    },
  })
  return { user, store }
}

async function createOnlineOrder(storeId: string, userId: string, overrides = {}) {
  const product = await prisma.product.create({
    data: {
      storeId,
      categoryId: (await prisma.productCategory.findFirst({ select: { id: true } }))!.id,
      name: 'Test Product',
      price: 100,
      slug: `test-product-${Date.now()}`,
    },
  })

  const order = await prisma.order.create({
    data: {
      userId,
      source: 'ONLINE',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      total: 100,
      subtotal: 100,
      shipping: 0,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          price: 100,
          availabilityType: 'IN_STOCK',
        },
      },
      ...overrides,
    },
    include: { items: true },
  })
  return { order, product }
}

async function createManualOrder(storeId: string, userId: string, overrides = {}) {
  const product = await prisma.product.create({
    data: {
      storeId,
      categoryId: (await prisma.productCategory.findFirst({ select: { id: true } }))!.id,
      name: 'Test Product Manual',
      price: 100,
      slug: `test-product-manual-${Date.now()}`,
    },
  })

  const order = await prisma.order.create({
    data: {
      userId,
      source: 'MANUAL',
      status: 'PROCESSING',
      paymentStatus: 'PENDING',
      total: 100,
      subtotal: 100,
      shipping: 0,
      items: {
        create: {
          productId: product.id,
          quantity: 1,
          price: 100,
          availabilityType: 'IN_STOCK',
        },
      },
      ...overrides,
    },
    include: { items: true },
  })
  return { order, product }
}

async function auditRows(orderId: string) {
  return prisma.sLADeadlineAudit.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
  })
}

async function setOverride(tx: any, override = true, reason = 'vendor_request') {
  if (override) {
    await tx.$executeRawUnsafe("SELECT set_config('app.admin_override', 'true', true)")
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.override_reason', $1, true)`,
      reason
    )
  } else {
    await tx.$executeRawUnsafe("SELECT set_config('app.admin_override', 'true', true)")
  }
}

describe('SLA Deadline Trigger (real DB)', () => {
  beforeAll(async () => {
    await setup()
  })

  afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await cleanup()
  })

  describe('1. First set allowed (initial calculation on transition to paid)', () => {
    it('sets slaDeadline on ONLINE order when paymentConfirmedAt is set and >= LEGACY_CUTOFF', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
        include: { items: true },
      })

      expect(updated.slaDeadline).not.toBeNull()
      const expected = new Date(paymentConfirmedAt.getTime() + 3 * 86400000 + 3 * 86400000)
      expect(updated.slaDeadline!.getTime()).toBeCloseTo(expected.getTime(), -3)

      expect(updated.slaPolicyDispatchDays).toBe(3)
      expect(updated.slaPolicyDeliveryWindowDays).toBe(3)

      const audit = await auditRows(order.id)
      expect(audit.length).toBe(1)
      expect(audit[0].source).toBe('calculated')
      expect(audit[0].previousDeadline).toBeNull()
      expect(audit[0].newDeadline!.getTime()).toBeCloseTo(expected.getTime(), -3)
      expect(audit[0].dispatchDays).toBe(3)
      expect(audit[0].deliveryWindowDays).toBe(3)
      expect(audit[0].reason).toBeNull()
    })

    it('uses custom slaPolicyDispatchDays and slaPolicyDeliveryWindowDays when provided', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID, {
        slaPolicyDispatchDays: 2,
        slaPolicyDeliveryWindowDays: 5,
      })

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      const updated = await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      expect(updated.slaPolicyDispatchDays).toBe(2)
      expect(updated.slaPolicyDeliveryWindowDays).toBe(5)
      const expected = new Date(paymentConfirmedAt.getTime() + 2 * 86400000 + 5 * 86400000)
      expect(updated.slaDeadline!.getTime()).toBeCloseTo(expected.getTime(), -3)

      const audit = await prisma.sLADeadlineAudit.findFirst({ where: { orderId: order.id } })
      expect(audit!.dispatchDays).toBe(2)
      expect(audit!.deliveryWindowDays).toBe(5)
      expect(audit!.source).toBe('calculated')
    })
  })

  describe('2. Locked after first set: a changed value raises', () => {
    it('changed value on an already-paid order raises without override', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const firstDeadline = (await prisma.order.findUnique({ where: { id: order.id } })).slaDeadline!

      const newDeadline = new Date(firstDeadline.getTime() + 5 * 86400000)
      await expect(
        prisma.order.update({
          where: { id: order.id },
          data: { slaDeadline: newDeadline },
        })
      ).rejects.toThrow()

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.slaDeadline!.getTime()).toBe(firstDeadline.getTime())

      const audit = await auditRows(order.id)
      expect(audit.length).toBe(1)
      expect(audit[0].source).toBe('calculated')
    })

    it('unset variable raises when admin_override is not set', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const firstDeadline = (await prisma.order.findUnique({ where: { id: order.id } })).slaDeadline!

      const newDeadline = new Date(firstDeadline.getTime() + 5 * 86400000)
      // No set_config('app.admin_override','true',true) in this session/transaction.
      await expect(
        prisma.order.update({
          where: { id: order.id },
          data: { slaDeadline: newDeadline },
        })
      ).rejects.toThrow()

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.slaDeadline!.getTime()).toBe(firstDeadline.getTime())
    })
  })

  describe('3. Admin override: actor + reason, trigger writes the audit row', () => {
    it('override without app.user_id raises even when admin_override is set', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const firstDeadline = (await prisma.order.findUnique({ where: { id: order.id } })).slaDeadline!
      const newDeadline = new Date(firstDeadline.getTime() + 5 * 86400000)

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SELECT set_config('app.admin_override', 'true', true)")
          await tx.$executeRawUnsafe(
            `SELECT set_config('app.override_reason', $1, true)`,
            'vendor_request'
          )
          // No app.user_id set.
          await tx.order.update({
            where: { id: order.id },
            data: { slaDeadline: newDeadline },
          })
        })
      ).rejects.toThrow()

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.slaDeadline!.getTime()).toBe(firstDeadline.getTime())
      expect(await auditRows(order.id)).toHaveLength(1)
    })

    it('override with whitespace-only reason raises', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const firstDeadline = (await prisma.order.findUnique({ where: { id: order.id } })).slaDeadline!
      const newDeadline = new Date(firstDeadline.getTime() + 5 * 86400000)

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SELECT set_config('app.admin_override', 'true', true)")
          await tx.$executeRawUnsafe(`SELECT set_config('app.user_id', $1, true)`, TEST_USER_ID)
          await tx.$executeRawUnsafe(`SELECT set_config('app.override_reason', $1, true)`, '   ')
          await tx.order.update({
            where: { id: order.id },
            data: { slaDeadline: newDeadline },
          })
        })
      ).rejects.toThrow()

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.slaDeadline!.getTime()).toBe(firstDeadline.getTime())
      expect(await auditRows(order.id)).toHaveLength(1)
    })

    it('override without a non-empty app.override_reason raises', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const firstDeadline = (await prisma.order.findUnique({ where: { id: order.id } })).slaDeadline!
      const newDeadline = new Date(firstDeadline.getTime() + 5 * 86400000)

      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SELECT set_config('app.admin_override', 'true', true)")
          // No app.override_reason set.
          await tx.order.update({
            where: { id: order.id },
            data: { slaDeadline: newDeadline },
          })
        })
      ).rejects.toThrow()

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.slaDeadline!.getTime()).toBe(firstDeadline.getTime())
      expect(await auditRows(order.id)).toHaveLength(1)
    })

    it('override with a reason succeeds and trigger writes the override audit row', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const originalDeadline = (await prisma.order.findUnique({ where: { id: order.id } })).slaDeadline!
      const newDeadline = new Date(originalDeadline.getTime() + 5 * 86400000)

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SELECT set_config('app.admin_override', 'true', true)")
        await tx.$executeRawUnsafe(
          `SELECT set_config('app.override_reason', $1, true)`,
          'vendor_request'
        )
        await tx.order.update({
          where: { id: order.id },
          data: { slaDeadline: newDeadline },
        })
      })

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.slaDeadline!.getTime()).toBe(newDeadline.getTime())

      const audit = await auditRows(order.id)
      expect(audit.length).toBe(2)
      expect(audit[0].source).toBe('calculated')
      expect(audit[1].source).toBe('override')
      expect(audit[1].previousDeadline!.getTime()).toBe(originalDeadline.getTime())
      expect(audit[1].newDeadline!.getTime()).toBe(newDeadline.getTime())
      expect(audit[1].reason).toBe('vendor_request')
      expect(audit[1].metadata).toMatchObject({ actor: TEST_USER_ID })
    })
  })

  describe('4. Old / legacy orders are never stamped', () => {
    it('does not stamp orders paid before LEGACY_CUTOFF on transition to paid', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const legacyPaymentConfirmedAt = new Date('2025-12-01T10:00:00.000Z')
      expect(legacyPaymentConfirmedAt.getTime()).toBeLessThan(LEGACY_CUTOFF.getTime())

      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt: legacyPaymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.paymentConfirmedAt).not.toBeNull()
      expect(after.slaDeadline).toBeNull()
      expect(await auditRows(order.id)).toEqual([])
    })

    it('does not restamp an already-paid order on later updates', async () => {
      const { order } = await createOnlineOrder(TEST_STORE_ID, TEST_USER_ID)

      const paymentConfirmedAt = new Date('2026-01-15T10:00:00.000Z')
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentConfirmedAt, paymentStatus: 'PAID', status: 'PROCESSING' },
      })

      const firstDeadline = (await prisma.order.findUnique({ where: { id: order.id } })).slaDeadline!

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'SHIPPED' },
      })

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.slaDeadline!.getTime()).toBe(firstDeadline.getTime())
      expect(await auditRows(order.id)).toHaveLength(1)
    })
  })

  describe('5. Manual orders are skipped', () => {
    it('trigger skips MANUAL orders even when paymentConfirmedAt is set', async () => {
      const { order } = await createManualOrder(TEST_STORE_ID, TEST_USER_ID, {
        paymentConfirmedAt: new Date('2026-01-15T10:00:00.000Z'),
        paymentStatus: 'PAID',
        status: 'PROCESSING',
      })

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.source).toBe('MANUAL')
      expect(after.slaDeadline).toBeNull()
      expect(await auditRows(order.id)).toEqual([])
    })

    it('confirm-payment on MANUAL order sets paymentConfirmedAt but not slaDeadline', async () => {
      const { order } = await createManualOrder(TEST_STORE_ID, TEST_USER_ID, {
        paymentStatus: 'PENDING',
        status: 'PENDING',
      })

      const now = new Date()
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID', paymentConfirmedAt: now, status: 'PROCESSING', paymentMethod: 'CASH' },
      })

      const after = await prisma.order.findUnique({ where: { id: order.id } })
      expect(after.paymentConfirmedAt).not.toBeNull()
      expect(after.slaDeadline).toBeNull()
      expect(await auditRows(order.id)).toEqual([])
    })
  })
})
