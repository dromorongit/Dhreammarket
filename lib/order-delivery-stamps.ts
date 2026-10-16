import { PrismaClient, Prisma } from '@prisma/client'

type StampField = 'shippedAt' | 'deliveredAt'

type TxClient = PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$use' | '$extends'>

interface StampOptions {
  orderId: string
  storeId: string
  field: StampField
  now: Date
  tx: TxClient
}

async function isSingleStoreOrder(tx: TxClient, orderId: string, storeId: string): Promise<boolean> {
  const itemsWithOtherStores = await tx.orderItem.count({
    where: {
      orderId,
      product: {
        storeId: { not: storeId }
      }
    }
  })
  return itemsWithOtherStores === 0
}

export async function stampOrderItems(options: StampOptions): Promise<number> {
  const { orderId, storeId, field, now, tx } = options

  if (!(await isSingleStoreOrder(tx, orderId, storeId))) {
    return 0
  }

  const items = await tx.orderItem.findMany({
    where: {
      orderId,
      product: { storeId },
      [field]: null
    },
    select: { id: true }
  })

  if (items.length === 0) {
    return 0
  }

  const itemIds = items.map(i => i.id)
  const updateData: Record<string, Date> = { [field]: now }
  
  if (field === 'deliveredAt') {
    updateData.shippedAt = now
  }

  const result = await tx.orderItem.updateMany({
    where: {
      id: { in: itemIds },
      [field]: null
    },
    data: updateData
  })

  return result.count
}