import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/* -------------------------------------------------------------------------- */
/* A fake Prisma that projects rows the way the real one does.                 */
/*                                                                            */
/* The whole point of this file is to catch a route that stops selecting its  */
/* fields and starts including a relation instead. So the fake must be        */
/* honest: a query WITHOUT a select returns every column of the row, and a    */
/* relation included with `true` returns every column of that relation too.   */
/* Only an explicit select hides a field.                                      */
/* -------------------------------------------------------------------------- */

type Row = Record<string, any>

/**
 * The relation names of the commerce models. A key that is not in this set is
 * a plain column, so a query that does not ask for a relation never gets it.
 */
const RELATION_KEYS = new Set([
  'images',
  'image',
  'category',
  'brandRelation',
  'store',
  'variants',
  'categoryAssignments',
  'productCategory',
  'product',
  'productVariant',
  'items',
  'payment',
  'user',
  'vendorCustomer',
  'products',
  'services',
  'vendor_categories',
])

function cloneRow(row: any): any {
  if (row instanceof Date) return new Date(row.getTime())
  if (Array.isArray(row)) return row.map(cloneRow)
  if (!row || typeof row !== 'object') return row
  return { ...row }
}

/** The plain columns of a row: everything that is not a relation. */
function scalarColumns(row: any): Row {
  const out: Row = {}
  if (!row || typeof row !== 'object') return out
  for (const [key, value] of Object.entries(row)) {
    if (RELATION_KEYS.has(key)) continue
    out[key] = cloneRow(value)
  }
  return out
}

function matchesWhere(row: any, where: any): boolean {
  if (!where) return true
  if (typeof where !== 'object') return true

  for (const [key, cond] of Object.entries(where as Row)) {
    if (key === 'AND') {
      if (!cond.every((c: any) => matchesWhere(row, c))) return false
      continue
    }
    if (key === 'OR') {
      if (!cond.some((c: any) => matchesWhere(row, c))) return false
      continue
    }
    if (key === 'NOT') {
      if (matchesWhere(row, cond)) return false
      continue
    }

    const value = row?.[key]

    if (cond === null) {
      if (value !== null && value !== undefined) return false
      continue
    }

    if (cond instanceof Date) {
      if (!(value instanceof Date) || value.getTime() !== cond.getTime()) return false
      continue
    }

    if (typeof cond === 'object') {
      if ('in' in cond) {
        if (!cond.in.includes(value)) return false
        continue
      }
      if ('notIn' in cond) {
        if (cond.notIn.includes(value)) return false
        continue
      }
      if ('gte' in cond) {
        if (!(value >= cond.gte)) return false
        continue
      }
      if ('gt' in cond) {
        if (!(value > cond.gt)) return false
        continue
      }
      if ('lt' in cond) {
        if (!(value < cond.lt)) return false
        continue
      }
      if ('lte' in cond) {
        if (!(value <= cond.lte)) return false
        continue
      }
      if ('contains' in cond) {
        const haystack = String(value ?? '').toLowerCase()
        if (!haystack.includes(String(cond.contains).toLowerCase())) return false
        continue
      }
      if ('some' in cond) {
        if (!Array.isArray(value)) return false
        if (!value.some((child) => matchesWhere(child, cond.some))) return false
        continue
      }
      if ('every' in cond) {
        if (!Array.isArray(value)) return false
        if (!value.every((child) => matchesWhere(child, cond.every))) return false
        continue
      }
      if ('none' in cond) {
        if (!Array.isArray(value)) return false
        if (value.some((child) => matchesWhere(child, cond.none))) return false
        continue
      }
      // An operator we do not model: do not filter the row out.
      continue
    }

    if (value !== cond) return false
  }

  return true
}

function sortRows(rows: Row[], orderBy: any): Row[] {
  if (!orderBy) return rows
  const entries = Object.entries(orderBy as Row)
  if (entries.length === 0) return rows
  const [field, direction] = entries[0]
  const factor = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = a?.[field]
    const right = b?.[field]
    if (left === right) return 0
    if (left === null || left === undefined) return 1
    if (right === null || right === undefined) return -1
    return (left > right ? 1 : -1) * factor
  })
}

/** Project one row through a relation spec (`select` / `include` / `true`). */
function projectRow(row: any, spec: any): any {
  if (spec === true || spec === undefined || spec === null) return scalarColumns(row)

  if (typeof spec !== 'object') return scalarColumns(row)

  if (spec.select) {
    const out: Row = {}
    for (const [key, sub] of Object.entries(spec.select as Row)) {
      out[key] = RELATION_KEYS.has(key)
        ? projectValue(row?.[key], sub)
        : cloneRow(row?.[key])
    }
    return out
  }

  if (spec.include) {
    // An include keeps every plain column of the row and adds the included
    // relations. This is where costPrice sneaks in.
    const out: Row = scalarColumns(row)
    for (const [key, sub] of Object.entries(spec.include as Row)) {
      out[key] = projectValue(row?.[key], sub)
    }
    return out
  }

  return scalarColumns(row)
}

function projectValue(value: any, sub: any): any {
  if (sub === true) {
    if (Array.isArray(value)) return value.map((entry) => scalarColumns(entry))
    return value === null || value === undefined ? value : scalarColumns(value)
  }

  if (sub && typeof sub === 'object') {
    if (Array.isArray(value)) {
      let rows = value
      if (sub.where) rows = rows.filter((row) => matchesWhere(row, sub.where))
      if (sub.orderBy) rows = sortRows(rows, sub.orderBy)
      if (typeof sub.take === 'number') rows = rows.slice(0, sub.take)
      return rows.map((row) => projectRow(row, sub))
    }
    if (value === null || value === undefined) return null
    return projectRow(value, sub)
  }

  return value
}

/* -------------------------------------------------------------------------- */
/* The rows the fake database holds.                                           */
/* -------------------------------------------------------------------------- */

const NOW = new Date('2026-03-01T00:00:00.000Z')

const RAW_CATEGORY = {
  id: 'cat_1',
  name: 'Widgets',
  slug: 'widgets',
  parentId: null,
  isActive: true,
}

const RAW_BRAND = { id: 'brand_1', name: 'Acme', slug: 'acme', logo: null }

const RAW_IMAGE = {
  id: 'img_1',
  productId: 'prod_1',
  url: 'https://cdn.example.com/widget.jpg',
  alt: 'Widget',
  mediaType: 'image',
}

const RAW_VARIANT = {
  id: 'var_1',
  productId: 'prod_1',
  color: 'Red',
  size: 'L',
  age: null,
  sku: 'SKU-1',
  price: 45,
  stock: 4,
  reservedQuantity: 0,
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
  // SECRET
  costPrice: 9.25,
}

const RAW_STORE_LITE = {
  id: 'store_1',
  slug: 'acme-store',
  name: 'Acme Store',
  logo: null,
  isVerified: true,
  badgeTier: 'PREMIUM',
  mainPhoneNumber: '+233200000001',
  averageRating: 4.6,
  reviewCount: 20,
}

const RAW_PRODUCT = {
  id: 'prod_1',
  slug: 'widget',
  storeId: 'store_1',
  categoryId: 'cat_1',
  name: 'Widget',
  description: 'A fine widget',
  brand: 'Acme',
  brandId: 'brand_1',
  price: 40,
  stock: 10,
  reservedQuantity: 2,
  lowStockThreshold: 5,
  averageRating: 4.5,
  reviewCount: 12,
  flashSalePrice: null,
  flashSaleStart: null,
  flashSaleEnd: null,
  salesCount: 3,
  isSponsored: true,
  dealsPrice: null,
  dealsStart: null,
  dealsEnd: null,
  salesPrice: null,
  availabilityType: 'IN_STOCK',
  expectedArrivalDate: null,
  estimatedFulfillmentDays: null,
  preOrderNotes: null,
  expectedRestockDate: null,
  backOrderNotes: null,
  isReturnable: true,
  createdAt: NOW,
  updatedAt: NOW,
  // SECRET
  costPrice: 7.5,
  images: [RAW_IMAGE],
  category: RAW_CATEGORY,
  brandRelation: RAW_BRAND,
  store: RAW_STORE_LITE,
  variants: [RAW_VARIANT],
  categoryAssignments: [
    {
      id: 'pca_1',
      productId: 'prod_1',
      productCategoryId: 'cat_1',
      isPrimary: true,
      productCategory: RAW_CATEGORY,
    },
  ],
  _count: { variants: 1, productReviews: 3 },
}

const RAW_ITEM_PRODUCT = {
  id: 'prod_1',
  slug: 'widget',
  name: 'Widget',
  storeId: 'store_1',
  price: 40,
  stock: 10,
  reservedQuantity: 2,
  availabilityType: 'IN_STOCK',
  images: [RAW_IMAGE],
  store: { id: 'store_1', name: 'Acme Store' },
  // SECRET
  costPrice: 7.5,
}

const RAW_ITEM = {
  id: 'item_1',
  orderId: 'order_1',
  productId: 'prod_1',
  quantity: 2,
  price: 20,
  grossAmount: 40,
  processorFee: 1.2,
  netAmount: 38.8,
  platformCommission: 4,
  vendorEarnings: 34,
  commissionRate: 0.1,
  createdAt: NOW,
  age: '3y',
  color: 'Red',
  productVariantId: 'var_1',
  size: 'L',
  availabilityType: 'IN_STOCK',
  expectedArrivalDate: null,
  expectedRestockDate: null,
  allocatedQuantity: 2,
  // SECRET
  costPriceSnapshot: 6,
  shippedAt: null,
  deliveredAt: null,
  deliveryConfirmedAt: null,
  deliveryConfirmedBy: null,
  product: RAW_ITEM_PRODUCT,
  productVariant: RAW_VARIANT,
}

const RAW_ORDER = {
  id: 'order_1',
  userId: 'user_1',
  grossAmount: 40,
  processorFee: 1.2,
  netAmount: 38.8,
  platformCommission: 4,
  vendorEarnings: 34,
  commissionRate: 0.1,
  total: 40,
  status: 'PROCESSING',
  paymentStatus: 'PAID',
  vendorAccepted: true,
  vendorRejected: false,
  vendorRejectionReason: null,
  deletedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
  customerAddress: '1 Main Street',
  customerCity: 'Accra',
  customerEmail: 'buyer@example.com',
  customerFirstName: 'Kofi',
  customerLastName: 'Buyer',
  customerPhone: '+233200000000',
  customerRegion: 'Greater Accra',
  shipping: 5,
  // SECRET
  deliveryCost: 3.5,
  shippingDaysMax: 3,
  shippingDaysMin: 1,
  shippingZone: 'Accra',
  subtotal: 35,
  tax: 0,
  orderType: 'NORMAL',
  fulfillmentStatus: 'PENDING',
  inventoryConsumedAt: null,
  allocatedAt: null,
  idempotencyKey: 'idem_1',
  walletAmountApplied: 0,
  source: 'ONLINE',
  channel: null,
  paymentMethod: 'CARD',
  paymentConfirmedAt: NOW,
  receiptToken: null,
  vendorCustomerId: null,
  items: [RAW_ITEM],
  payment: {
    id: 'pay_1',
    userId: 'user_1',
    orderId: 'order_1',
    amount: 40,
    currency: 'GHS',
    status: 'SUCCESS',
    reference: 'REF-1',
    paystackRef: 'PS-1',
    message: null,
    createdAt: NOW,
    updatedAt: NOW,
  },
  user: {
    id: 'user_1',
    email: 'buyer@example.com',
    profile: {
      firstName: 'Kofi',
      lastName: 'Buyer',
      phone: '+233200000000',
      address: '1 Main Street',
    },
  },
}

const RAW_MANUAL_ITEM = {
  ...RAW_ITEM,
  id: 'item_m1',
  orderId: 'order_m1',
  quantity: 1,
  price: 40,
  costPriceSnapshot: 7.5,
}

const RAW_MANUAL_ORDER = {
  ...RAW_ORDER,
  id: 'order_m1',
  userId: null,
  status: 'PROCESSING',
  paymentStatus: 'PENDING',
  source: 'MANUAL',
  channel: 'WHATSAPP',
  paymentMethod: 'CASH',
  receiptToken: 'a'.repeat(32),
  subtotal: 40,
  shipping: 5,
  total: 45,
  deliveryCost: 2.5,
  vendorCustomerId: 'vc_1',
  items: [RAW_MANUAL_ITEM],
  payment: null,
  user: null,
  vendorCustomer: {
    id: 'vc_1',
    store: {
      name: 'Acme Store',
      slug: 'acme-store',
      logo: null,
      mainPhoneNumber: '+233200000001',
      whatsappNumber: null,
    },
  },
}

const RAW_CART_ITEM = {
  id: 'citem_1',
  cartId: 'cart_1',
  productId: 'prod_1',
  quantity: 2,
  createdAt: NOW,
  age: '3y',
  color: 'Red',
  productVariantId: 'var_1',
  size: 'L',
  product: {
    id: 'prod_1',
    name: 'Widget',
    price: 40,
    dealsPrice: null,
    salesPrice: null,
    stock: 10,
    reservedQuantity: 2,
    availabilityType: 'IN_STOCK',
    expectedArrivalDate: null,
    estimatedFulfillmentDays: null,
    preOrderNotes: null,
    expectedRestockDate: null,
    backOrderNotes: null,
    images: [RAW_IMAGE],
    // SECRET
    costPrice: 7.5,
  },
  productVariant: RAW_VARIANT,
}

const RAW_CART = {
  id: 'cart_1',
  userId: 'user_1',
  createdAt: NOW,
  updatedAt: NOW,
  items: [RAW_CART_ITEM],
}

const RAW_SERVICE = {
  id: 'svc_1',
  vendorId: 'vendor_1',
  categoryId: 'scat_1',
  title: 'Widget repair',
  slug: 'widget-repair',
  description: 'We fix widgets',
  shortDescription: 'Widget repair',
  startingPrice: 25,
  pricingType: 'FIXED_PRICE',
  deliveryType: 'ONLINE',
  availabilityStatus: 'AVAILABLE',
  thumbnail: null,
  gallery: [],
  isActive: true,
  isFeatured: false,
  createdAt: NOW,
  updatedAt: NOW,
  estimatedDeliveryTime: '2 days',
  requirementsFromCustomer: null,
  status: 'PUBLISHED',
  tags: [],
  averageRating: 4,
  reviewCount: 3,
  images: [],
  category: { id: 'scat_1', name: 'Services', slug: 'services' },
  store: RAW_STORE_LITE,
}

const RAW_STORE = {
  ...RAW_STORE_LITE,
  userId: 'vendor_1',
  description: 'We sell widgets',
  isFeatured: false,
  featuredUntil: null,
  banner: null,
  createdAt: NOW,
  updatedAt: NOW,
  alternativePhoneNumber: null,
  whatsappNumber: null,
  acceptsPreOrders: true,
  acceptsBackOrders: false,
  location: 'Accra',
  address: '1 Main Street',
  email: 'store@example.com',
  canSellProducts: true,
  canOfferServices: false,
  setupComplete: true,
  categoryId: 'vcat_1',
  products: [RAW_PRODUCT],
  services: [RAW_SERVICE],
  vendor_categories: { id: 'vcat_1', name: 'Widgets', slug: 'widgets' },
  user: {
    id: 'vendor_1',
    profile: { firstName: 'Ama', lastName: 'Seller', avatar: null },
  },
  _count: { products: 1, services: 1 },
}

const RAW_FLASH_DEAL = {
  id: 'deal_1',
  title: 'Widget week',
  description: 'Save on widgets',
  discountType: 'PERCENTAGE',
  discountValue: 10,
  maxDiscount: null,
  startDate: new Date('2020-01-01T00:00:00.000Z'),
  endDate: new Date('2099-01-01T00:00:00.000Z'),
  vendorId: 'vendor_1',
  isActive: true,
  createdAt: NOW,
  updatedAt: NOW,
  products: [
    {
      id: 'fdp_1',
      flashDealId: 'deal_1',
      productId: 'prod_1',
      serviceId: null,
      product: RAW_PRODUCT,
      service: null,
    },
  ],
}

/* -------------------------------------------------------------------------- */
/* The fake Prisma                                                            */
/* -------------------------------------------------------------------------- */

const TABLES: Record<string, Row[]> = {
  products: [RAW_PRODUCT],
  productVariants: [RAW_VARIANT],
  orders: [RAW_ORDER, RAW_MANUAL_ORDER],
  orderItems: [RAW_ITEM, RAW_MANUAL_ITEM],
  carts: [RAW_CART],
  cartItems: [RAW_CART_ITEM],
  stores: [RAW_STORE],
  services: [RAW_SERVICE],
  flashDeals: [RAW_FLASH_DEAL],
  productCompares: [
    { id: 'pc_1', userId: 'user_1', productId: 'prod_1', addedAt: NOW },
  ],
  vendorReviews: [
    {
      id: 'vr_1',
      storeId: 'store_1',
      rating: 5,
      isApproved: true,
      isHidden: false,
      user: { profile: { firstName: 'A' } },
    },
  ],
  vendorTrustBadges: [],
}

function rowsFor(model: string): Row[] {
  return TABLES[model] ?? []
}

function makeModel(model: string) {
  const findMany = vi.fn(async (args: any = {}) => {
    let rows = rowsFor(model).filter((row) => matchesWhere(row, args.where))
    if (args.orderBy) rows = sortRows(rows, args.orderBy)
    if (typeof args.skip === 'number') rows = rows.slice(args.skip)
    if (typeof args.take === 'number') rows = rows.slice(0, args.take)
    return rows.map((row) => projectRow(row, args.select ? { select: args.select } : args.include ? { include: args.include } : undefined))
  })

  return {
    findMany,
    findFirst: vi.fn(async (args: any = {}) => {
      const rows = await findMany({ ...args, take: 1 })
      return rows[0] ?? null
    }),
    findUnique: vi.fn(async (args: any = {}) => {
      const rows = await findMany({ ...args, take: 1 })
      return rows[0] ?? null
    }),
    count: vi.fn(async (args: any = {}) => rowsFor(model).filter((row) => matchesWhere(row, args.where)).length),
    create: vi.fn(async (args: any) => projectRow({ ...(args?.data ?? {}) }, undefined)),
    update: vi.fn(async (args: any) => projectRow({ ...(args?.data ?? {}) }, undefined)),
    updateMany: vi.fn(async () => ({ count: 0 })),
    delete: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async (args: any) => projectRow({ ...(args?.create ?? {}) }, undefined)),
  }
}

const prismaMock = vi.hoisted(() => ({
  product: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  productVariant: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  order: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  orderItem: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  cart: { findUnique: vi.fn(), findMany: vi.fn() },
  cartItem: { findMany: vi.fn(), findUnique: vi.fn() },
  store: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  service: { findMany: vi.fn(), findUnique: vi.fn() },
  flashDeal: { findMany: vi.fn(), findUnique: vi.fn() },
  productCompare: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  vendorReview: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
  vendorFollow: { count: vi.fn(), findMany: vi.fn() },
  vendorTrustBadge: { findMany: vi.fn() },
  productReview: { count: vi.fn(), findMany: vi.fn() },
  productCategory: { findUnique: vi.fn(), findMany: vi.fn() },
  brand: { findUnique: vi.fn(), findMany: vi.fn() },
  refund: { findMany: vi.fn(), count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

const getCategoryFilterIdsMock = vi.hoisted(() => vi.fn(async () => ['cat_1']))
vi.mock('@/lib/categories', () => ({ getCategoryFilterIds: getCategoryFilterIdsMock }))

const checkExpiredPreOrdersMock = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('@/lib/product-availability', () => ({
  checkAndUpdateExpiredPreOrders: checkExpiredPreOrdersMock,
}))

import { GET as productsListGET } from '@/app/api/products/route'
import { GET as productDetailGET } from '@/app/api/products/[id]/route'
import { GET as vendorStorefrontGET } from '@/app/api/vendors/[id]/route'
import { GET as vendorShowcaseGET } from '@/app/api/vendors/[id]/showcase/route'
import { GET as cartGET } from '@/app/api/cart/route'
import { GET as buyerOrdersGET } from '@/app/api/orders/route'
import { GET as buyerOrderDetailGET } from '@/app/api/orders/[orderId]/route'
import { GET as flashDealsGET } from '@/app/api/flash-deals/route'
import { GET as compareGET } from '@/app/api/compare/route'
import { getReceiptByToken } from '@/lib/receipts'

/* -------------------------------------------------------------------------- */
/* Assertions                                                                  */
/* -------------------------------------------------------------------------- */

const FORBIDDEN = ['costPrice', 'costPriceSnapshot', 'deliveryCost', 'variantCostPrice', 'productCostPrice']

function findForbiddenFields(value: unknown, path = '$'): string[] {
  const found: string[] = []
  if (Array.isArray(value)) {
    value.forEach((entry, index) => found.push(...findForbiddenFields(entry, `${path}[${index}]`)))
    return found
  }
  if (!value || typeof value !== 'object') return found
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN.includes(key)) found.push(`${path}.${key}`)
    found.push(...findForbiddenFields(entry, `${path}.${key}`))
  }
  return found
}

function expectNoCostFields(payload: unknown) {
  const found = findForbiddenFields(payload)
  expect(found, `cost fields leaked: ${found.join(', ')}`).toEqual([])
}

const BUYER = {
  authenticated: true,
  userId: 'user_1',
  role: 'CUSTOMER',
  sessionId: 'sess_buyer',
}

const VENDOR = {
  authenticated: true,
  userId: 'vendor_1',
  role: 'VENDOR',
  sessionId: 'sess_vendor',
}

function buildRequest(url: string, withToken = true): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: withToken ? { cookie: 'token=test-token' } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()

  prismaMock.product.findMany.mockImplementation(makeModel('products').findMany)
  prismaMock.product.findFirst.mockImplementation(makeModel('products').findFirst)
  prismaMock.product.findUnique.mockImplementation(makeModel('products').findUnique)
  prismaMock.product.count.mockImplementation(makeModel('products').count)

  prismaMock.productVariant.findMany.mockImplementation(makeModel('productVariants').findMany)
  prismaMock.productVariant.findFirst.mockImplementation(makeModel('productVariants').findFirst)
  prismaMock.productVariant.findUnique.mockImplementation(makeModel('productVariants').findUnique)
  prismaMock.productVariant.count.mockImplementation(makeModel('productVariants').count)

  prismaMock.order.findMany.mockImplementation(makeModel('orders').findMany)
  prismaMock.order.findFirst.mockImplementation(makeModel('orders').findFirst)
  prismaMock.order.findUnique.mockImplementation(makeModel('orders').findUnique)
  prismaMock.order.count.mockImplementation(makeModel('orders').count)

  prismaMock.orderItem.findMany.mockImplementation(makeModel('orderItems').findMany)
  prismaMock.orderItem.findFirst.mockImplementation(makeModel('orderItems').findFirst)
  prismaMock.orderItem.findUnique.mockImplementation(makeModel('orderItems').findUnique)
  prismaMock.orderItem.count.mockImplementation(makeModel('orderItems').count)

  prismaMock.cart.findUnique.mockImplementation(makeModel('carts').findUnique)
  prismaMock.cart.findMany.mockImplementation(makeModel('carts').findMany)
  prismaMock.cartItem.findMany.mockImplementation(makeModel('cartItems').findMany)
  prismaMock.cartItem.findUnique.mockImplementation(makeModel('cartItems').findUnique)

  prismaMock.store.findUnique.mockImplementation(makeModel('stores').findUnique)
  prismaMock.store.findMany.mockImplementation(makeModel('stores').findMany)
  prismaMock.store.count.mockImplementation(makeModel('stores').count)

  prismaMock.service.findMany.mockImplementation(makeModel('services').findMany)
  prismaMock.service.findUnique.mockImplementation(makeModel('services').findUnique)

  prismaMock.flashDeal.findMany.mockImplementation(makeModel('flashDeals').findMany)
  prismaMock.flashDeal.findUnique.mockImplementation(makeModel('flashDeals').findUnique)

  prismaMock.productCompare.findMany.mockImplementation(makeModel('productCompares').findMany)
  prismaMock.productCompare.findFirst.mockImplementation(makeModel('productCompares').findFirst)
  prismaMock.productCompare.count.mockImplementation(makeModel('productCompares').count)

  prismaMock.vendorReview.findMany.mockImplementation(makeModel('vendorReviews').findMany)
  prismaMock.vendorReview.findFirst.mockImplementation(makeModel('vendorReviews').findFirst)
  prismaMock.vendorReview.count.mockImplementation(makeModel('vendorReviews').count)

  prismaMock.vendorFollow.count.mockResolvedValue(3)
  prismaMock.vendorFollow.findMany.mockResolvedValue([])
  prismaMock.vendorTrustBadge.findMany.mockResolvedValue([])
  prismaMock.productReview.count.mockResolvedValue(2)
  prismaMock.productReview.findMany.mockResolvedValue([])
  prismaMock.productCategory.findUnique.mockResolvedValue(null)
  prismaMock.productCategory.findMany.mockResolvedValue([])
  prismaMock.brand.findUnique.mockResolvedValue(null)
  prismaMock.brand.findMany.mockResolvedValue([])
  prismaMock.refund.findMany.mockResolvedValue([])
  prismaMock.refund.count.mockResolvedValue(0)

  verifyTokenMock.mockResolvedValue(BUYER)
  isVendorOnboardedMock.mockResolvedValue(true)
})

describe('public product surfaces never carry a cost price', () => {
  it('the public products list has no cost field, not even in nested variants', async () => {
    const response = await productsListGET(buildRequest('http://localhost/api/products', false))
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.products.length).toBeGreaterThan(0)
    expectNoCostFields(body)
  })

  it('the public products list selects every field it returns', async () => {
    await productsListGET(buildRequest('http://localhost/api/products', false))
    const call = prismaMock.product.findMany.mock.calls[0]?.[0] as any
    expect(call.include).toBeUndefined()
    expect(call.select).toBeDefined()
    expect(call.select).not.toHaveProperty('costPrice')
  })

  it('the product detail has no cost field, not even in nested variants', async () => {
    const response = await productDetailGET(
      buildRequest('http://localhost/api/products/widget', false),
      { params: { id: 'widget' } }
    )
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.product).toBeTruthy()
    expect(body.product.variants.length).toBeGreaterThan(0)
    expectNoCostFields(body)
  })

  it('the product detail selects the variants explicitly', async () => {
    await productDetailGET(
      buildRequest('http://localhost/api/products/widget', false),
      { params: { id: 'widget' } }
    )
    const call = prismaMock.product.findUnique.mock.calls[0]?.[0] as any
    expect(call.include).toBeUndefined()
    expect(call.select).toBeDefined()
    expect(call.select).not.toHaveProperty('costPrice')
    expect(call.select.variants.select).not.toHaveProperty('costPrice')
  })

  it('the vendor storefront has no cost field', async () => {
    const response = await vendorStorefrontGET(
      buildRequest('http://localhost/api/vendors/acme-store', false),
      { params: { id: 'acme-store' } }
    )
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.vendor.products.length).toBeGreaterThan(0)
    expectNoCostFields(body)
  })

  it('the vendor showcase has no cost field', async () => {
    const response = await vendorShowcaseGET(
      buildRequest('http://localhost/api/vendors/vendor_1/showcase', false),
      { params: { id: 'vendor_1' } }
    )
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.vendor.featuredProducts.length).toBeGreaterThan(0)
    expectNoCostFields(body)
  })

  it('the vendor showcase selects every product field', async () => {
    await vendorShowcaseGET(
      buildRequest('http://localhost/api/vendors/vendor_1/showcase', false),
      { params: { id: 'vendor_1' } }
    )
    const call = prismaMock.product.findMany.mock.calls[0]?.[0] as any
    expect(call.include).toBeUndefined()
    expect(call.select).not.toHaveProperty('costPrice')
  })

  it('the flash deals list has no cost field', async () => {
    const response = await flashDealsGET(buildRequest('http://localhost/api/flash-deals', false))
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.deals.length).toBeGreaterThan(0)
    expectNoCostFields(body)
  })

  it('the comparison list has no cost field, not even in nested variants', async () => {
    const response = await compareGET(buildRequest('http://localhost/api/compare'))
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.products.length).toBeGreaterThan(0)
    expect(body.products[0].variants.length).toBeGreaterThan(0)
    expectNoCostFields(body)
  })
})

describe('buyer surfaces never carry a cost price', () => {
  it('the cart has no cost field, not even in the variant', async () => {
    const response = await cartGET(buildRequest('http://localhost/api/cart'))
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.cart.items.length).toBeGreaterThan(0)
    expect(body.cart.items[0].productVariant).toBeTruthy()
    expectNoCostFields(body)
  })

  it('the buyer order list has no cost field', async () => {
    const response = await buyerOrdersGET(buildRequest('http://localhost/api/orders'))
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.orders.length).toBeGreaterThan(0)
    expect(body.orders[0].items.length).toBeGreaterThan(0)
    expectNoCostFields(body)
  })

  it('the buyer order detail has no cost field', async () => {
    const response = await buyerOrderDetailGET(
      buildRequest('http://localhost/api/orders/order_1'),
      { params: { orderId: 'order_1' } }
    )
    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body.order.items.length).toBeGreaterThan(0)
    expect(body.order.items[0].productVariant).toBeTruthy()
    expectNoCostFields(body)
  })

  it('the buyer order endpoints select every field they return', async () => {
    await buyerOrdersGET(buildRequest('http://localhost/api/orders'))
    const listCall = prismaMock.order.findMany.mock.calls[0]?.[0] as any
    expect(listCall.include).toBeUndefined()
    expect(listCall.select).not.toHaveProperty('deliveryCost')
    expect(listCall.select.items.select).not.toHaveProperty('costPriceSnapshot')

    await buyerOrderDetailGET(
      buildRequest('http://localhost/api/orders/order_1'),
      { params: { orderId: 'order_1' } }
    )
    const detailCall = prismaMock.order.findFirst.mock.calls[0]?.[0] as any
    expect(detailCall.include).toBeUndefined()
    expect(detailCall.select).not.toHaveProperty('deliveryCost')
    expect(detailCall.select.items.select).not.toHaveProperty('costPriceSnapshot')
    expect(detailCall.select.items.select.productVariant.select).not.toHaveProperty('costPrice')
  })
})

describe('the public receipt DTO never carries a cost price', () => {
  it('returns no cost field', async () => {
    const receipt = await getReceiptByToken('a'.repeat(32))
    expect(receipt).toBeTruthy()
    expect(receipt!.items.length).toBeGreaterThan(0)
    expectNoCostFields(receipt)
  })

  it('never spells the secret under another name', async () => {
    const receipt = await getReceiptByToken('a'.repeat(32))
    const keys = Object.keys(receipt as unknown as Record<string, unknown>)
    for (const key of keys) {
      expect(FORBIDDEN).not.toContain(key)
    }
  })
})
