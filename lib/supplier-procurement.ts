import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'

type PurchaseOrderStatus = 'DRAFT' | 'ORDERED' | 'SHIPPED' | 'ARRIVED' | 'RECEIVED' | 'CANCELLED'
type SupplierDocumentType = 'CONTRACT' | 'INVOICE' | 'QUOTATION' | 'AGREEMENT'
type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'DISABLED'

export interface SupplierData {
  companyName: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  country?: string
  notes?: string
  status?: SupplierStatus
}

export interface PurchaseOrderData {
  supplierId: string
  vendorId: string
  expectedArrivalDate?: Date
  notes?: string
  status?: PurchaseOrderStatus
  totalCost?: number
  items: Array<{
    productId: string
    quantity: number
    unitCost: number
    totalCost?: number
  }>
}

export interface SupplierPerformanceMetrics {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  lateDeliveries: number
  averageLeadTime: number | null
  onTimePercentage: number | null
  reliabilityScore: number | null
}

export interface SupplierListItem {
  id: string
  companyName: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  address: string | null
  country: string | null
  notes: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface PurchaseOrderItem {
  id: string
  poNumber: string | null
  supplierId: string
  supplierName: string
  status: string
  totalCost: number
  expectedArrivalDate: Date | null
  actualArrivalDate: Date | null
  daysUntilArrival: number | null
  isOverdue: boolean
  createdAt: Date
  isLinked: boolean
}

export async function createSupplier(
  data: SupplierData
): Promise<{ success: boolean; supplier?: any; error?: string }> {
  const prisma = getPrisma()
  try {
    const supplier = await (prisma as any).supplier.create({
      data: {
        companyName: data.companyName,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        address: data.address,
        country: data.country,
        notes: data.notes,
        status: data.status || 'ACTIVE',
      },
    })
    return { success: true, supplier }
  } catch (error) {
    console.error('Error creating supplier:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create supplier' }
  }
}

export async function updateSupplier(
  supplierId: string,
  data: Partial<SupplierData>
): Promise<{ success: boolean; supplier?: any; error?: string }> {
  const prisma = getPrisma()
  try {
    const supplier = await (prisma as any).supplier.update({
      where: { id: supplierId },
      data: {
        ...(data.companyName && { companyName: data.companyName }),
        ...(data.contactPerson && { contactPerson: data.contactPerson }),
        ...(data.email && { email: data.email }),
        ...(data.phone && { phone: data.phone }),
        ...(data.address && { address: data.address }),
        ...(data.country && { country: data.country }),
        ...(data.notes && { notes: data.notes }),
        ...(data.status && { status: data.status }),
      },
    })
    return { success: true, supplier }
  } catch (error) {
    console.error('Error updating supplier:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update supplier' }
  }
}

export async function disableSupplier(
  supplierId: string,
  disabled: boolean = true
): Promise<{ success: boolean; error?: string }> {
  const prisma = getPrisma()
  try {
    await (prisma as any).supplier.update({
      where: { id: supplierId },
      data: { status: disabled ? 'DISABLED' : 'ACTIVE' },
    })
    return { success: true }
  } catch (error) {
    console.error('Error disabling supplier:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to disable supplier' }
  }
}

export async function getSuppliers(includeDisabled: boolean): Promise<SupplierListItem[]> {
  const prisma = getPrisma()
  const suppliers = await (prisma as any).supplier.findMany({
    where: includeDisabled ? {} : { status: { not: 'DISABLED' } },
    orderBy: { createdAt: 'desc' },
  })
  return suppliers.map((s: any) => ({
    id: s.id,
    companyName: s.companyName,
    contactPerson: s.contactPerson,
    email: s.email,
    phone: s.phone,
    address: s.address,
    country: s.country,
    notes: s.notes,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))
}

export async function getSupplierById(supplierId: string) {
  const prisma = getPrisma()
  return (prisma as any).supplier.findUnique({
    where: { id: supplierId },
    include: {
      purchaseOrders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      documents: true,
    },
  })
}

export async function calculateSupplierPerformance(
  supplierId: string
): Promise<SupplierPerformanceMetrics> {
  const prisma = getPrisma()
  const [totalOrders, completedOrders, cancelledOrders, receivedOrders] = await Promise.all([
    (prisma as any).purchaseOrder.count({ where: { supplierId } }),
    (prisma as any).purchaseOrder.count({ where: { supplierId, status: 'RECEIVED' } }),
    (prisma as any).purchaseOrder.count({ where: { supplierId, status: 'CANCELLED' } }),
    (prisma as any).purchaseOrder.findMany({
      where: {
        supplierId,
        status: 'RECEIVED',
        actualArrivalDate: { not: null },
        expectedArrivalDate: { not: null },
      },
    }),
  ])

  const lateDeliveries = (receivedOrders as any[]).filter((o: any) => {
    if (!o.expectedArrivalDate || !o.actualArrivalDate) return false
    return new Date(o.actualArrivalDate) > new Date(o.expectedArrivalDate)
  }).length

  const leadTimes = (receivedOrders as any[])
    .filter((o: any) => o.expectedArrivalDate && o.actualArrivalDate)
    .map((o: any) => {
      const expected = new Date(o.expectedArrivalDate).getTime()
      const actual = new Date(o.actualArrivalDate).getTime()
      return Math.abs((actual - expected) / (1000 * 60 * 60 * 24))
    })

  const averageLeadTime = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((sum: number, lt: number) => sum + lt, 0) / leadTimes.length)
    : null

  const onTimePercentage = completedOrders > 0
    ? Math.round(((completedOrders - lateDeliveries) / completedOrders) * 100)
    : null

  const reliabilityScore = onTimePercentage !== null
    ? Math.round(onTimePercentage * 0.7 + (1 - (cancelledOrders / totalOrders)) * 100 * 0.3)
    : null

  return {
    totalOrders,
    completedOrders,
    cancelledOrders,
    lateDeliveries,
    averageLeadTime,
    onTimePercentage,
    reliabilityScore,
  }
}

export async function createPurchaseOrder(
  data: PurchaseOrderData
): Promise<{ success: boolean; purchaseOrder?: any; error?: string }> {
  const prisma = getPrisma()
  try {
    const supplier = await (prisma as any).supplier.findUnique({
      where: { id: data.supplierId },
    })
    if (!supplier) {
      return { success: false, error: 'Supplier not found' }
    }
    if (supplier.status === 'DISABLED') {
      return { success: false, error: 'Supplier is disabled' }
    }

    const store = await (prisma as any).store.findUnique({
      where: { userId: data.vendorId },
      select: { id: true },
    })
    if (!store) {
      return { success: false, error: 'Unauthorized: Vendor store not found' }
    }

    const totalCost = data.items.reduce((sum: number, item: any) => {
      const itemTotal = item.totalCost || (item.quantity * item.unitCost)
      return sum + itemTotal
    }, 0)

    const poNumber = `PO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    const purchaseOrder = await (prisma as any).purchaseOrder.create({
      data: {
        supplierId: data.supplierId,
        vendorId: data.vendorId,
        poNumber,
        expectedArrivalDate: data.expectedArrivalDate,
        notes: data.notes,
        status: data.status || 'DRAFT',
        totalCost,
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost || (item.quantity * item.unitCost),
          })),
        },
      },
      include: {
        supplier: true,
        items: {
          include: { product: { select: { name: true } } },
        },
      },
    })

    await createNotification(
      data.vendorId,
      'RESTOCK_ORDER_CREATED',
      'Purchase Order Created',
      `Purchase order ${poNumber} has been created with ${data.items.length} items.`
    ).catch((err: Error) => console.error('Failed to notify vendor:', err))

    return { success: true, purchaseOrder }
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create purchase order' }
  }
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  vendorId: string,
  newStatus: PurchaseOrderStatus
): Promise<{ success: boolean; purchaseOrder?: any; error?: string }> {
  const prisma = getPrisma()
  const validTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
    DRAFT: ['ORDERED', 'CANCELLED'],
    ORDERED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['ARRIVED', 'CANCELLED'],
    ARRIVED: ['RECEIVED', 'CANCELLED'],
    RECEIVED: [],
    CANCELLED: [],
  }
  try {
    const purchaseOrder = await (prisma as any).purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: true },
    })
    if (!purchaseOrder) {
      return { success: false, error: 'Purchase order not found' }
    }
    if (purchaseOrder.vendorId !== vendorId) {
      return { success: false, error: 'Unauthorized: Not your purchase order' }
    }

    const currentStatus = purchaseOrder.status as PurchaseOrderStatus
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return { success: false, error: `Invalid status transition from ${currentStatus} to ${newStatus}` }
    }

    const updateData: any = { status: newStatus }
    if (newStatus === 'RECEIVED') {
      updateData.actualArrivalDate = new Date()
      updateData.receivedAt = new Date()
    }

    const updatedOrder = await (prisma as any).purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: updateData,
      include: {
        supplier: true,
        items: {
          include: { product: { select: { name: true } } },
        },
      },
    })

    await createNotification(
      vendorId,
      'RESTOCK_ORDER_CREATED',
      `Purchase Order ${newStatus}`,
      `Purchase order ${purchaseOrder.poNumber} status updated to ${newStatus}.`
    ).catch((err: Error) => console.error('Failed to notify vendor:', err))

    return { success: true, purchaseOrder: updatedOrder }
  } catch (error) {
    console.error('Error updating purchase order status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update purchase order status' }
  }
}

export async function linkPurchaseOrderToRestock(
  purchaseOrderId: string,
  restockOrderId: string,
  vendorId: string
): Promise<{ success: boolean; error?: string }> {
  const prisma = getPrisma()
  try {
    const [purchaseOrder, restockOrder] = await Promise.all([
      (prisma as any).purchaseOrder.findUnique({ where: { id: purchaseOrderId } }),
      (prisma as any).restockOrder.findUnique({ where: { id: restockOrderId } }),
    ])

    if (!purchaseOrder) {
      return { success: false, error: 'Purchase order not found' }
    }
    if (!restockOrder) {
      return { success: false, error: 'Restock order not found' }
    }
    if (purchaseOrder.vendorId !== vendorId || (restockOrder as any).vendorId !== vendorId) {
      return { success: false, error: 'Unauthorized: Not your order' }
    }

    await (prisma as any).restockOrder.update({
      where: { id: restockOrderId },
      data: { purchaseOrderId },
    })
    return { success: true }
  } catch (error) {
    console.error('Error linking purchase order to restock:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to link orders' }
  }
}

export async function getVendorPurchaseOrders(
  vendorId: string,
  includeCancelled: boolean
): Promise<PurchaseOrderItem[]> {
  const prisma = getPrisma()
  const where: any = { vendorId }
  if (!includeCancelled) {
    where.status = { not: 'CANCELLED' }
  }

  const purchaseOrders = await (prisma as any).purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { companyName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (purchaseOrders as any[]).map((po: any) => {
    const expected = po.expectedArrivalDate ? new Date(po.expectedArrivalDate) : null
    const isOverdue = expected ? expected < today && po.status !== 'RECEIVED' && po.status !== 'CANCELLED' : false
    const daysUntilArrival = expected
      ? Math.ceil((expected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return {
      id: po.id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplier.companyName,
      status: po.status,
      totalCost: po.totalCost,
      expectedArrivalDate: po.expectedArrivalDate,
      actualArrivalDate: po.actualArrivalDate,
      daysUntilArrival,
      isOverdue,
      createdAt: po.createdAt,
      isLinked: po.restockOrders.length > 0,
    }
  })
}

export async function getVendorProcurementDashboard(
  vendorId: string
): Promise<{
  openPurchaseOrders: number
  ordersInTransit: number
  overduePurchaseOrders: number
  bestSupplier: { id: string; name: string; reliabilityScore: number | null } | null
  totalProcurementSpend: number
}> {
  const prisma = getPrisma()
  const [openOrders, inTransitOrders, overdueOrders, totalSpend, suppliersWithPerformance] = await Promise.all([
    (prisma as any).purchaseOrder.count({
      where: { vendorId, status: { in: ['ORDERED', 'DRAFT'] } },
    }),
    (prisma as any).purchaseOrder.count({
      where: { vendorId, status: { in: ['SHIPPED', 'ARRIVED'] } },
    }),
    (prisma as any).purchaseOrder.count({
      where: {
        vendorId,
        status: { in: ['ORDERED', 'SHIPPED', 'ARRIVED'] },
        expectedArrivalDate: { lt: new Date() },
      },
    }),
    (prisma as any).purchaseOrder.aggregate({
      where: { vendorId, status: 'RECEIVED' },
      _sum: { totalCost: true },
    }),
    (prisma as any).supplier.findMany({
      where: { purchaseOrders: { some: { vendorId } } },
      select: { id: true, companyName: true },
    }),
  ])

  const performanceScores = await Promise.all(
    (suppliersWithPerformance as any[]).map(async (s: { id: string; companyName: string }) => ({
      ...(await calculateSupplierPerformance(s.id)),
      supplier: { id: s.id, name: s.companyName, reliabilityScore: null as number | null },
    }))
  )

  const bestSupplier = performanceScores
    .filter((p: any) => p.reliabilityScore !== null)
    .sort((a: any, b: any) => (b.reliabilityScore || 0) - (a.reliabilityScore || 0))[0]

  return {
    openPurchaseOrders: openOrders,
    ordersInTransit: inTransitOrders,
    overduePurchaseOrders: overdueOrders,
    bestSupplier: bestSupplier ? { id: bestSupplier.supplier.id, name: bestSupplier.supplier.name, reliabilityScore: bestSupplier.reliabilityScore } : null,
    totalProcurementSpend: (totalSpend as any)._sum.totalCost || 0,
  }
}

export async function addSupplierDocument(
  supplierId: string,
  documentType: SupplierDocumentType,
  documentUrl: string,
  fileName?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; document?: any; error?: string }> {
  const prisma = getPrisma()
  try {
    const supplier = await (prisma as any).supplier.findUnique({
      where: { id: supplierId },
    })
    if (!supplier) {
      return { success: false, error: 'Supplier not found' }
    }

    const document = await (prisma as any).supplierDocument.create({
      data: {
        supplierId,
        documentType,
        documentUrl,
        fileName,
        metadata,
      },
    })
    return { success: true, document }
  } catch (error) {
    console.error('Error adding supplier document:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to add document' }
  }
}

export async function generatePurchaseOrderPDF(purchaseOrderId: string): Promise<string | null> {
  return `/api/vendor/purchase-orders/${purchaseOrderId}/pdf`
}