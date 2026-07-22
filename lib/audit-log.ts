import { getPrisma } from './prisma'

export type EntityType = 'USER' | 'VENDOR' | 'PRODUCT' | 'ORDER' | 'SUPPORT_TICKET' | 'RESTOCK_ORDER' | 'PURCHASE_ORDER' | 'KYC_APPLICATION' | 'INVENTORY' | 'SYSTEM'

export type AuditAction = 
  | 'VENDOR_APPROVED' | 'VENDOR_REJECTED' | 'USER_SUSPENDED' | 'USER_REACTIVATED' | 'ACCOUNT_DEACTIVATED' | 'ACCOUNT_DELETE_REQUESTED' | 'ORDER_CANCELLED' | 'ORDER_REFUNDED' | 'PRODUCT_REMOVED' | 'SUPPORT_TICKET_UPDATED' | 'KYC_APPROVED' | 'KYC_REJECTED'
  | 'PRODUCT_CREATED' | 'PRODUCT_UPDATED' | 'PRODUCT_DELETED' | 'INVENTORY_UPDATED' | 'RESTOCK_ORDER_CREATED' | 'RESTOCK_ORDER_UPDATED' | 'PURCHASE_ORDER_CREATED' | 'PURCHASE_ORDER_UPDATED' | 'STORE_PROFILE_UPDATED'
  | 'SUPPORT_TICKET_CREATED' | 'PROFILE_UPDATED'
  | 'PAYMENT_CONFIRMED' | 'PAYMENT_FAILED' | 'INVENTORY_CONSUMED' | 'INVENTORY_ALLOCATED' | 'STOCK_RESERVED' | 'STOCK_RELEASED'
  | 'VENDOR_BADGE_ASSIGNED' | 'VENDOR_BADGE_UPDATED' | 'VENDOR_BADGE_REMOVED'
  | 'PASSWORD_CHANGED'

interface AuditLogData {
  userId: string
  userRole: string
  action: AuditAction
  entityType: EntityType
  entityId?: string | null
  beforeData?: any
  afterData?: any
  ipAddress?: string | null
  userAgent?: string | null
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await getPrisma().auditLog.create({
      data: {
        userId: data.userId,
        userRole: data.userRole,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId || null,
        beforeData: data.beforeData || null,
        afterData: data.afterData || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}

export function captureBeforeAfter(before: any, after: any): { beforeData: any; afterData: any } {
  const sanitizeData = (data: any): any => {
    if (!data) return null
    const result: any = {}
    for (const key of Object.keys(data)) {
      if (data[key] !== undefined) {
        result[key] = data[key]
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }

  return {
    beforeData: sanitizeData(before),
    afterData: sanitizeData(after),
  }
}

export function getEntityChanges(before: any, after: any): string[] {
  if (!before || !after) return []

  const changes: string[] = []
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))

  for (const key of allKeys) {
    const beforeVal = before[key]
    const afterVal = after[key]
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes.push(key)
    }
  }

  return changes
}

export async function getAuditLogs(params: {
  page?: number
  limit?: number
  action?: string
  entityType?: string
  userId?: string
  dateFrom?: Date
  dateTo?: Date
  search?: string
}) {
  const { page = 1, limit = 50, action, entityType, userId, dateFrom, dateTo, search } = params
  const skip = (page - 1) * limit

  const where: any = {}

  if (action) {
    where.action = action
  }

  if (entityType) {
    where.entityType = entityType
  }

  if (userId) {
    where.userId = userId
  }

  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) {
      where.createdAt.gte = dateFrom
    }
    if (dateTo) {
      where.createdAt.lte = dateTo
    }
  }

  if (search) {
    where.OR = [
      { user: { email: { contains: search, mode: 'insensitive' } } },
      { user: { profile: { firstName: { contains: search, mode: 'insensitive' } } } },
      { user: { profile: { lastName: { contains: search, mode: 'insensitive' } } } },
    ]
  }

  const [logs, total] = await Promise.all([
    getPrisma().auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    }),
    getPrisma().auditLog.count({ where }),
  ])

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}