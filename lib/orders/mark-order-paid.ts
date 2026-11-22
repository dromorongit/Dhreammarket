import { Prisma, PrismaClient, OrderStatus } from '@prisma/client'

export async function markOrderPaid(
  db: Prisma.TransactionClient | PrismaClient,
  orderId: string,
  extra: { status?: OrderStatus } = {},
): Promise<boolean> {
  const result = await db.order.updateMany({
    where: { id: orderId, paymentConfirmedAt: null },
    data: { paymentStatus: 'PAID', paymentConfirmedAt: new Date(), ...extra },
  })
  return result.count > 0
}
