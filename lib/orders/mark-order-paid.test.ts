import { getPrisma } from '@/lib/prisma'
import { markOrderPaid } from '@/lib/orders/mark-order-paid'

const url = process.env.DATABASE_URL ?? ''
let host = ''
try { host = new URL(url).hostname.toLowerCase() } catch { host = '' }
if (host !== 'localhost' && host !== '127.0.0.1') {
  throw new Error('Aborting: DATABASE_URL host is not localhost')
}

const prisma = getPrisma()

const mopDbCheck = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`
if (mopDbCheck[0]?.current_database !== 'dhream_dev') {
  throw new Error('Refusing to run: current_database is not dhream_dev')
}

let dbAvailable = false
try {
  await prisma.$queryRaw`SELECT 1`
  dbAvailable = true
} catch {
  dbAvailable = false
}

if (!dbAvailable) {
  throw new Error('Database not available for markOrderPaid tests')
}

describe('markOrderPaid (real DB)', () => {
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
