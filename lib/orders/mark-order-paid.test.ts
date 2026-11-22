import { getPrisma } from '@/lib/prisma'
import { markOrderPaid } from '@/lib/orders/mark-order-paid'

const url = process.env.DATABASE_URL ?? ''
if (!/localhost|127\.0\.0\.1/.test(url)) {
  throw new Error('Aborting: DATABASE_URL is not localhost')
}

const prisma = getPrisma()

let dbAvailable = false
try {
  await prisma.$queryRaw`SELECT 1`
  dbAvailable = true
} catch {
  dbAvailable = false
}

describe.skipIf(!dbAvailable)('markOrderPaid (real DB)', () => {
  it('wallet order gets paymentConfirmedAt via UPDATE', async () => {
    const order = await prisma.order.create({
      data: { total: 100, status: 'PROCESSING', paymentStatus: 'PENDING' },
    })

    const paid = await markOrderPaid(prisma, order.id)
    expect(paid).toBe(true)

    const after = await prisma.order.findUnique({ where: { id: order.id } })
    expect(after?.paymentStatus).toBe('PAID')
    expect(after?.paymentConfirmedAt).not.toBeNull()

    const paidAt = after?.paymentConfirmedAt
    const second = await markOrderPaid(prisma, order.id)
    expect(second).toBe(false)

    const afterSecond = await prisma.order.findUnique({ where: { id: order.id } })
    expect(afterSecond?.paymentConfirmedAt).toEqual(paidAt)

    await prisma.order.delete({ where: { id: order.id } })
  })

  it('wallet checkout ends PAID with paymentConfirmedAt set and an audit row from the SLA trigger', async () => {
    const order = await prisma.order.create({
      data: { total: 100, status: 'PROCESSING', paymentStatus: 'PENDING', source: 'ONLINE' },
    })

    const paid = await markOrderPaid(prisma, order.id, { status: 'PROCESSING' })
    expect(paid).toBe(true)

    const after = await prisma.order.findUnique({ where: { id: order.id } })
    expect(after?.paymentStatus).toBe('PAID')
    expect(after?.paymentConfirmedAt).not.toBeNull()
    expect(after?.slaDeadline).not.toBeNull()

    const audits = await prisma.sLADeadlineAudit.findMany({ where: { orderId: order.id } })
    expect(audits.length).toBeGreaterThan(0)

    await prisma.order.delete({ where: { id: order.id } })
  })

  it('two concurrent markOrderPaid calls, only one returns true', async () => {
    const order = await prisma.order.create({
      data: { total: 100, status: 'PROCESSING', paymentStatus: 'PENDING' },
    })

    const [a, b] = await Promise.all([
      markOrderPaid(prisma, order.id),
      markOrderPaid(prisma, order.id),
    ])
    expect([a, b].filter(Boolean).length).toBe(1)

    await prisma.order.delete({ where: { id: order.id } })
  })
})
