// Seller Commerce OS - money view.
//
// One pure module that defines what a vendor's revenue, cost, profit and
// receivables are, so every screen (dashboard card, sales page, CSV export)
// reads the same numbers.
//
// Rules encoded here:
//
//  * All money is integer pesewas (1 cedi = 100 pesewas). Floats only exist
//    at the database boundary and are converted on the way in and out.
//  * A counted sale is an order with paymentStatus PAID and status not
//    CANCELLED, inside the requested period (Africa/Accra day boundaries).
//  * MANUAL revenue is the order total (items + the delivery fee charged to
//    the customer). ONLINE revenue is the vendor's own vendorEarnings share,
//    already net of platform commission and the processor fee.
//  * COGS is sum(quantity * unit cost) where the unit cost is, in order:
//    the MANUAL sale-time snapshot, the variant cost, the product cost.
//    A line with no cost at all is excluded from COGS and counted as a
//    missing cost, so a vendor never sees a profit that pretends to be
//    complete when it is not.
//  * ONLINE orders use the CURRENT cost, never a snapshot, so their profit is
//    flagged as estimated.
//  * Profit is always labelled "Profit before other expenses".
//
// This module is pure: it touches no database and no clock of its own (the
// caller passes `now`).

export const PESEWAS_PER_CEDI = 100
export const ACCRA_TIME_ZONE = 'Africa/Accra'

/**
 * The one label used for the profit number everywhere in the vendor UI.
 */
export const PROFIT_LABEL = 'Profit before other expenses'

export type SalesSourceFilter = 'ALL' | 'ONLINE' | 'MANUAL'
export type SalesSource = 'ONLINE' | 'MANUAL'
export type SalesChannel =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'CALL'
  | 'WALK_IN'
  | 'OTHER'
  | 'MARKETPLACE'

export const SALES_SOURCE_FILTERS: SalesSourceFilter[] = ['ALL', 'ONLINE', 'MANUAL']

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook',
  CALL: 'Call',
  WALK_IN: 'Walk-in',
  OTHER: 'Other',
  MARKETPLACE: 'Marketplace',
}

export const MANUAL_CHANNELS: SalesChannel[] = [
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'CALL',
  'WALK_IN',
  'OTHER',
]

/** Max number of calendar days a single report may span. */
export const MAX_RANGE_DAYS = 366

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Convert a cedi amount to integer pesewas.
 *
 * The double is scaled first, then corrected for the binary representation
 * error before rounding, so 2.675 becomes 268 pesewas and not 267. Amounts
 * with more than two decimals are rejected at the API boundary; this helper
 * only has to be correct for the values that survive that check.
 */
export function toPesewas(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 0
  const scaled = amount * PESEWAS_PER_CEDI
  const corrected = Math.round(scaled * 1e6) / 1e6
  return Math.round(corrected)
}

/** Convert integer pesewas back to a cedi Float for display or the DB. */
export function fromPesewas(pesewas: number): number {
  if (!Number.isFinite(pesewas)) return 0
  return Number((pesewas / PESEWAS_PER_CEDI).toFixed(2))
}

/**
 * Round a cedi amount to 2 decimals, in pesewas.
 */
export function roundToPesewas(amount: number): number {
  return toPesewas(amount)
}

/* -------------------------------------------------------------------------- */
/* Africa/Accra day boundaries                                                */
/* -------------------------------------------------------------------------- */

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  formatterCache.set(timeZone, formatter)
  return formatter
}

/**
 * The wall-clock parts of an instant in a given time zone.
 */
export function getZonedParts(instant: Date, timeZone: string = ACCRA_TIME_ZONE): ZonedParts {
  const parts = getPartsFormatter(timeZone).formatToParts(instant)
  const lookup: Record<string, number> = {}
  for (const part of parts) {
    if (part.type === 'literal') continue
    const value = Number(part.value)
    if (Number.isFinite(value)) lookup[part.type] = value
  }
  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    hour: lookup.hour === 24 ? 0 : lookup.hour,
    minute: lookup.minute,
    second: lookup.second,
  }
}

/**
 * The UTC offset of a time zone, in minutes, at a given instant.
 */
export function getZoneOffsetMinutes(instant: Date, timeZone: string = ACCRA_TIME_ZONE): number {
  const p = getZonedParts(instant, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - instant.getTime()) / 60000)
}

/**
 * Shift an instant by whole calendar days, keeping the same wall-clock time.
 */
export function addCalendarDays(
  instant: Date,
  days: number,
  timeZone: string = ACCRA_TIME_ZONE,
): Date {
  const p = getZonedParts(instant, timeZone)
  const wall = Date.UTC(p.year, p.month - 1, p.day + days, p.hour, p.minute, p.second)
  const offset = getZoneOffsetMinutes(new Date(wall), timeZone)
  return new Date(wall - offset * 60000)
}

/**
 * The UTC instant of 00:00:00 on the calendar day that contains `instant`.
 */
export function startOfDayInZone(instant: Date, timeZone: string = ACCRA_TIME_ZONE): Date {
  const p = getZonedParts(instant, timeZone)
  const wall = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0)
  let offset = getZoneOffsetMinutes(new Date(wall), timeZone)
  let result = new Date(wall - offset * 60000)
  const second = getZoneOffsetMinutes(result, timeZone)
  if (second !== offset) {
    offset = second
    result = new Date(wall - offset * 60000)
  }
  return result
}

/** The 'YYYY-MM-DD' calendar day of an instant in Africa/Accra. */
export function accraDayKey(instant: Date): string {
  const p = getZonedParts(instant, ACCRA_TIME_ZONE)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** The UTC instant of Accra midnight for the day that contains `instant`. */
export function accraDayStart(instant: Date): Date {
  return startOfDayInZone(instant, ACCRA_TIME_ZONE)
}

/** The UTC instant of Accra midnight on the day AFTER the day of `instant`. */
export function accraDayEndExclusive(instant: Date): Date {
  return startOfDayInZone(addCalendarDays(instant, 1), ACCRA_TIME_ZONE)
}

/**
 * Parse a 'YYYY-MM-DD' calendar day into the UTC instant of Accra midnight.
 * Returns null for anything that is not a real calendar day.
 */
export function parseAccraDayKey(dayKey: unknown): Date | null {
  if (typeof dayKey !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const wall = Date.UTC(year, month - 1, day, 0, 0, 0)
  const probe = new Date(wall)
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }
  return new Date(wall - getZoneOffsetMinutes(probe, ACCRA_TIME_ZONE) * 60000)
}

/**
 * Every Accra calendar day between two instants, inclusive of both ends.
 */
export function accraDayKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = []
  let cursor = accraDayStart(from)
  const end = accraDayStart(to)
  let guard = 0
  while (cursor.getTime() <= end.getTime() && guard < 500) {
    keys.push(accraDayKey(cursor))
    cursor = addCalendarDays(cursor, 1)
    guard += 1
  }
  return keys
}

/**
 * The number of Accra calendar days between two instants, inclusive of both.
 */
export function accraDayCount(from: Date, to: Date): number {
  return accraDayKeysBetween(from, to).length
}

/* -------------------------------------------------------------------------- */
/* Period picking                                                             */
/* -------------------------------------------------------------------------- */

export type SalesPeriodKey = 'today' | '7d' | '30d' | 'month' | 'custom'

export const SALES_PERIOD_KEYS: SalesPeriodKey[] = ['today', '7d', '30d', 'month', 'custom']

export const SALES_PERIOD_LABELS: Record<SalesPeriodKey, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  month: 'This month',
  custom: 'Custom',
}

export interface SalesPeriodRange {
  from: string
  to: string
}

/**
 * The 'YYYY-MM-DD' Accra days a named period covers.
 *
 * `today` is one day, `7d` and `30d` include today and look back 6 and 29
 * days, `month` runs from the first day of the current Accra month.
 */
export function salesPeriodRange(
  period: SalesPeriodKey,
  now: Date = new Date(),
  custom?: { from?: string | null; to?: string | null },
): SalesPeriodRange {
  if (period === 'custom') {
    const from = custom?.from || accraDayKey(now)
    const to = custom?.to || accraDayKey(now)
    return { from, to }
  }

  const today = accraDayStart(now)
  const todayKey = accraDayKey(today)

  if (period === 'today') {
    return { from: todayKey, to: todayKey }
  }

  if (period === 'month') {
    const parts = getZonedParts(today, ACCRA_TIME_ZONE)
    const monthStart = new Date(Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0))
    return { from: accraDayKey(monthStart), to: todayKey }
  }

  const days = period === '7d' ? 7 : 30
  const from = accraDayStart(addCalendarDays(today, -(days - 1)))
  return { from: accraDayKey(from), to: todayKey }
}

/* -------------------------------------------------------------------------- */
/* Input validation                                                           */
/* -------------------------------------------------------------------------- */

export interface DateRange {
  from: Date
  to: Date
}

/**
 * Validate a `from`/`to` pair. Both are inclusive Accra calendar days.
 * `from` defaults to 29 days before `to`; `to` defaults to today (Accra).
 */
export function validateDateRange(
  fromRaw: unknown,
  toRaw: unknown,
  now: Date = new Date(),
): { range: DateRange; error?: undefined } | { range?: undefined; error: string } {
  let to: Date
  if (toRaw === undefined || toRaw === null || toRaw === '') {
    to = accraDayStart(now)
  } else {
    const parsed = parseAccraDayKey(toRaw)
    if (!parsed) return { error: 'to must be a valid date in YYYY-MM-DD format' }
    to = parsed
  }

  let from: Date
  if (fromRaw === undefined || fromRaw === null || fromRaw === '') {
    from = accraDayStart(addCalendarDays(to, -29))
  } else {
    const parsed = parseAccraDayKey(fromRaw)
    if (!parsed) return { error: 'from must be a valid date in YYYY-MM-DD format' }
    from = parsed
  }

  if (from.getTime() > to.getTime()) {
    return { error: 'from must not be after to' }
  }

  const days = accraDayCount(from, to)
  if (days > MAX_RANGE_DAYS) {
    return { error: `date range must not exceed ${MAX_RANGE_DAYS} days` }
  }

  return { range: { from, to } }
}

/**
 * Validate the `source` query parameter.
 */
export function validateSourceFilter(sourceRaw: unknown): {
  source: SalesSourceFilter
  error?: undefined
} | { source?: undefined; error: string } {
  if (sourceRaw === undefined || sourceRaw === null || sourceRaw === '') {
    return { source: 'ALL' }
  }
  if (typeof sourceRaw !== 'string') {
    return { error: 'source must be one of ALL, ONLINE, MANUAL' }
  }
  const value = sourceRaw.trim().toUpperCase()
  if (!SALES_SOURCE_FILTERS.includes(value as SalesSourceFilter)) {
    return { error: 'source must be one of ALL, ONLINE, MANUAL' }
  }
  return { source: value as SalesSourceFilter }
}

/**
 * Validate a cost price: finite, >= 0, at most 2 decimals.
 *
 * `null` and `undefined` mean "not provided" (leave the cost alone); an
 * empty string is also treated as "not provided" so a form can send it.
 */
export function validateCostPrice(
  costPrice: unknown,
): { provided: true; pesewas: number } | { provided: false } | { error: string } {
  if (costPrice === undefined || costPrice === null || costPrice === '') {
    return { provided: false }
  }
  if (typeof costPrice !== 'number' || !Number.isFinite(costPrice)) {
    return { error: 'costPrice must be a finite number' }
  }
  if (costPrice < 0) {
    return { error: 'costPrice must be >= 0' }
  }
  if (Math.round(costPrice * PESEWAS_PER_CEDI) / PESEWAS_PER_CEDI !== costPrice) {
    return { error: 'costPrice must have at most 2 decimal places' }
  }
  return { provided: true, pesewas: toPesewas(costPrice) }
}

/**
 * Validate a delivery cost: finite, >= 0, at most 2 decimals.
 *
 * `undefined`, `null` and the empty string mean "not provided", so a caller
 * can tell "the vendor did not tell us" from "the vendor said zero".
 */
export function validateDeliveryCost(
  deliveryCost: unknown,
): { provided: true; pesewas: number } | { provided: false } | { error: string } {
  if (deliveryCost === undefined || deliveryCost === null || deliveryCost === '') {
    return { provided: false }
  }
  if (typeof deliveryCost !== 'number' || !Number.isFinite(deliveryCost)) {
    return { error: 'deliveryCost must be a finite number' }
  }
  if (deliveryCost < 0) {
    return { error: 'deliveryCost must be >= 0' }
  }
  if (Math.round(deliveryCost * PESEWAS_PER_CEDI) / PESEWAS_PER_CEDI !== deliveryCost) {
    return { error: 'deliveryCost must have at most 2 decimal places' }
  }
  return { provided: true, pesewas: toPesewas(deliveryCost) }
}

/* -------------------------------------------------------------------------- */
/* Summary input shapes                                                       */
/* -------------------------------------------------------------------------- */

export interface SalesSummaryItemInput {
  id: string
  productId: string
  productVariantId: string | null
  productName: string
  variantLabel: string | null
  quantity: number
  price: number
  /** Sale-time cost snapshot. Only MANUAL orders write one. */
  costPriceSnapshot: number | null
  /** Current cost of the variant, if the variant has one. */
  variantCostPrice: number | null
  /** Current cost of the product. */
  productCostPrice: number | null
  /** The vendor's own share of this line, already net of fees (ONLINE only). */
  vendorEarnings: number | null
}

export interface SalesSummaryOrderInput {
  id: string
  source: SalesSource
  channel: string | null
  status: string
  paymentStatus: string
  createdAt: Date
  /** cedi: items + the delivery fee charged to the customer. */
  total: number
  /** Whole-order vendor earnings (ONLINE). */
  vendorEarnings: number | null
  /** Whole-order net amount (ONLINE). */
  netAmount: number | null
  /** What the vendor actually paid the rider. */
  deliveryCost: number | null
  customerFirstName?: string | null
  customerLastName?: string | null
  customerPhone?: string | null
  receiptToken?: string | null
  paymentMethod?: string | null
  /** Pre-resolved customer name (online orders get the buyer's name or email). */
  customerName?: string | null
  items: SalesSummaryItemInput[]
}

export interface SalesSummaryRefundInput {
  id: string
  orderId: string | null
  amount: number
  status: string
  createdAt: Date
}

export interface SalesSummaryInput {
  orders: SalesSummaryOrderInput[]
  refunds: SalesSummaryRefundInput[]
  from: Date
  to: Date
  now: Date
  source: SalesSourceFilter
  /** How many of the vendor's products/variants still have no cost price. */
  missingCostProducts: number
  /**
   * The receivables to report, when they are known.
   *
   * Receivables are what the vendor is still owed, so they are NOT limited by
   * the period: the routes read them with an all-time query and pass them
   * here. When this is omitted the receivables of the period orders are used.
   */
  receivables?: ReceivablesSummary | null
}

/* -------------------------------------------------------------------------- */
/* Summary output shapes                                                      */
/* -------------------------------------------------------------------------- */

export interface SalesSummaryTotals {
  revenue: number
  revenuePesawas: number
  cogs: number
  cogsPesawas: number
  deliveryCost: number
  deliveryCostPesawas: number
  profit: number
  profitPesawas: number
  profitLabel: string
  profitIsExact: boolean
  estimated: boolean
  estimatedReasons: string[]
  orders: number
  units: number
  items: number
  itemsWithCost: number
  missingCostItems: number
  costCoveragePercent: number
  averageOrderValue: number
}

export interface SalesBreakdownRow {
  key: string
  label: string
  orders: number
  units: number
  revenue: number
  revenuePesawas: number
  cogs: number
  cogsPesawas: number
  profit: number
  profitPesawas: number
  estimated: boolean
}

export interface SalesProductRow {
  productId: string
  productVariantId: string | null
  productName: string
  variantLabel: string | null
  units: number
  revenue: number
  revenuePesawas: number
  cogs: number
  cogsPesawas: number
  profit: number
  profitPesawas: number
  estimated: boolean
}

export interface SalesDailyRow {
  date: string
  orders: number
  units: number
  revenue: number
  revenuePesawas: number
  cogs: number
  cogsPesawas: number
  profit: number
  profitPesawas: number
  estimated: boolean
}

export interface ReceivableOrderRow {
  id: string
  displayNumber: string
  customerName: string | null
  customerPhone: string | null
  channel: SalesChannel
  channelLabel: string
  total: number
  totalPesawas: number
  createdAt: string
  ageDays: number
  receiptToken: string | null
}

export interface ReceivablesSummary {
  amount: number
  amountPesawas: number
  count: number
  oldestAgeDays: number
  oldestCreatedAt: string | null
  orders: ReceivableOrderRow[]
}

export interface RefundsSummary {
  amount: number
  amountPesawas: number
  processedAmount: number
  processedAmountPesawas: number
  pendingAmount: number
  pendingAmountPesawas: number
  count: number
  orders: Array<{
    id: string
    orderId: string | null
    amount: number
    status: string
    createdAt: string
  }>
}

export interface SalesSummaryResult {
  currency: 'GHS'
  range: {
    from: string
    to: string
    days: number
  }
  source: SalesSourceFilter
  profitLabel: string
  totals: SalesSummaryTotals
  bySource: SalesBreakdownRow[]
  byChannel: SalesBreakdownRow[]
  topProductsByUnits: SalesProductRow[]
  topProductsByProfit: SalesProductRow[]
  daily: SalesDailyRow[]
  receivables: ReceivablesSummary
  refunds: RefundsSummary
  coverage: {
    items: number
    itemsWithCost: number
    missingCostItems: number
    costCoveragePercent: number
    missingCostProducts: number
  }
}

/* -------------------------------------------------------------------------- */
/* Core rules                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * True when the order counts as a sale for the money view: it was charged
 * and it was not cancelled.
 */
export function isCountedSale(order: { paymentStatus?: string | null; status?: string | null }): boolean {
  if (order.paymentStatus !== 'PAID') return false
  if (!order.status) return false
  return order.status !== 'CANCELLED'
}

/**
 * True when the order is an unpaid (but not cancelled) manual sale, i.e. a
 * receivable the vendor is still owed.
 */
export function isReceivable(order: {
  source?: string | null
  paymentStatus?: string | null
  status?: string | null
}): boolean {
  if (order.source !== 'MANUAL') return false
  if (order.paymentStatus !== 'PENDING') return false
  if (!order.status) return false
  return order.status !== 'CANCELLED'
}

/**
 * The channel a sale is attributed to. Online sales are always the
 * marketplace; manual sales use the channel the vendor picked.
 */
export function resolveChannel(order: { source: SalesSource; channel?: string | null }): SalesChannel {
  if (order.source === 'ONLINE') return 'MARKETPLACE'
  const channel = order.channel
  if (channel && (MANUAL_CHANNELS as string[]).includes(channel)) {
    return channel as SalesChannel
  }
  return 'OTHER'
}

/**
 * The unit cost of one line, in pesewas, or null when no cost is known.
 *
 * MANUAL sales prefer the sale-time snapshot so that editing a product's
 * cost later never rewrites past profit. ONLINE sales use the current cost
 * and are therefore flagged as estimated.
 */
export function resolveUnitCostPesawas(
  order: { source: SalesSource },
  item: {
    costPriceSnapshot?: number | null
    variantCostPrice?: number | null
    productCostPrice?: number | null
  },
): number | null {
  if (order.source === 'MANUAL' && item.costPriceSnapshot !== null && item.costPriceSnapshot !== undefined) {
    return toPesewas(item.costPriceSnapshot)
  }
  if (item.variantCostPrice !== null && item.variantCostPrice !== undefined) {
    return toPesewas(item.variantCostPrice)
  }
  if (item.productCostPrice !== null && item.productCostPrice !== undefined) {
    return toPesewas(item.productCostPrice)
  }
  return null
}

/**
 * The revenue of one order, in pesewas.
 *
 * MANUAL: the order total (items + the delivery fee charged to the customer).
 * No platform fees are subtracted because a manual sale never had any.
 *
 * ONLINE: the vendor's own share of the order (vendorEarnings), already net
 * of platform commission and the processor fee. The per-line share is used
 * when it exists so that a cart holding two vendors' products is counted for
 * this vendor only.
 */
export function orderRevenuePesawas(order: SalesSummaryOrderInput): number {
  if (order.source === 'MANUAL') {
    return toPesewas(order.total)
  }

  const lineEarnings = (order.items || [])
    .map((item) =>
      item.vendorEarnings === null || item.vendorEarnings === undefined
        ? null
        : toPesewas(item.vendorEarnings),
    )
    .filter((value): value is number => value !== null)

  if (lineEarnings.length > 0) {
    return lineEarnings.reduce((sum, value) => sum + value, 0)
  }

  const fallback = order.vendorEarnings ?? order.netAmount ?? order.total
  return toPesewas(fallback)
}

export interface OrderCostResult {
  cogsPesawas: number
  items: number
  itemsWithCost: number
  missingCostItems: number
  units: number
  unitsWithCost: number
}

/**
 * The cost of goods sold for one order, in pesewas, plus the cost coverage
 * counters. Lines with no known cost are excluded from COGS.
 */
export function orderCogsPesawas(order: SalesSummaryOrderInput): OrderCostResult {
  let cogsPesawas = 0
  let items = 0
  let itemsWithCost = 0
  let units = 0
  let unitsWithCost = 0

  for (const item of order.items || []) {
    items += 1
    const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
    units += quantity
    const unitCost = resolveUnitCostPesawas(order, item)
    if (unitCost === null) continue
    itemsWithCost += 1
    unitsWithCost += quantity
    cogsPesawas += unitCost * quantity
  }

  return {
    cogsPesawas,
    items,
    itemsWithCost,
    missingCostItems: items - itemsWithCost,
    units,
    unitsWithCost,
  }
}

/**
 * The order display number: the last 8 characters of the id, upper-cased.
 */
export function salesDisplayNumber(orderId: string): string {
  return orderId.slice(-8).toUpperCase()
}

/**
 * The full name of a customer on a manual order, if one is known.
 */
export function salesCustomerName(order: {
  customerName?: string | null
  customerFirstName?: string | null
  customerLastName?: string | null
}): string | null {
  if (typeof order.customerName === 'string' && order.customerName.trim().length > 0) {
    return order.customerName.trim()
  }
  const first = order.customerFirstName?.trim()
  const last = order.customerLastName?.trim()
  if (!first && !last) return null
  return [first, last].filter(Boolean).join(' ')
}

/* -------------------------------------------------------------------------- */
/* The summary builder                                                        */
/* -------------------------------------------------------------------------- */

interface Accumulator {
  orders: number
  units: number
  revenuePesawas: number
  cogsPesawas: number
  deliveryCostPesawas: number
  items: number
  itemsWithCost: number
  missingCostItems: number
  hasOnline: boolean
  hasUnknownDeliveryCost: boolean
}

function emptyAccumulator(): Accumulator {
  return {
    orders: 0,
    units: 0,
    revenuePesawas: 0,
    cogsPesawas: 0,
    deliveryCostPesawas: 0,
    items: 0,
    itemsWithCost: 0,
    missingCostItems: 0,
    hasOnline: false,
    hasUnknownDeliveryCost: false,
  }
}

function accumulate(acc: Accumulator, order: SalesSummaryOrderInput): {
  revenuePesawas: number
  cogsPesawas: number
} {
  const revenuePesawas = orderRevenuePesawas(order)
  const cost = orderCogsPesawas(order)

  acc.orders += 1
  acc.units += cost.units
  acc.revenuePesawas += revenuePesawas
  acc.cogsPesawas += cost.cogsPesawas
  acc.items += cost.items
  acc.itemsWithCost += cost.itemsWithCost
  acc.missingCostItems += cost.missingCostItems
  if (order.source === 'ONLINE') acc.hasOnline = true

  if (order.deliveryCost !== null && order.deliveryCost !== undefined) {
    acc.deliveryCostPesawas += toPesewas(order.deliveryCost)
  } else if (order.source === 'MANUAL') {
    // Only a manual sale is delivered by the vendor, so only a manual sale
    // can have an unknown delivery cost. An online sale is delivered by the
    // platform and never has one.
    acc.hasUnknownDeliveryCost = true
  }

  return { revenuePesawas, cogsPesawas: cost.cogsPesawas }
}

function accumulatorTotals(acc: Accumulator): SalesSummaryTotals {
  const profitPesawas = acc.revenuePesawas - acc.cogsPesawas - acc.deliveryCostPesawas
  const costCoveragePercent =
    acc.items === 0 ? 100 : Math.round((acc.itemsWithCost / acc.items) * 10000) / 100

  const estimatedReasons: string[] = []
  if (acc.missingCostItems > 0) estimatedReasons.push('missing_cost_prices')
  if (acc.hasOnline) estimatedReasons.push('online_current_cost')
  if (acc.hasUnknownDeliveryCost) estimatedReasons.push('unknown_delivery_cost')

  return {
    revenue: fromPesewas(acc.revenuePesawas),
    revenuePesawas: acc.revenuePesawas,
    cogs: fromPesewas(acc.cogsPesawas),
    cogsPesawas: acc.cogsPesawas,
    deliveryCost: fromPesewas(acc.deliveryCostPesawas),
    deliveryCostPesawas: acc.deliveryCostPesawas,
    profit: fromPesewas(profitPesawas),
    profitPesawas,
    profitLabel: PROFIT_LABEL,
    profitIsExact: estimatedReasons.length === 0,
    estimated: estimatedReasons.length > 0,
    estimatedReasons,
    orders: acc.orders,
    units: acc.units,
    items: acc.items,
    itemsWithCost: acc.itemsWithCost,
    missingCostItems: acc.missingCostItems,
    costCoveragePercent,
    averageOrderValue: acc.orders === 0 ? 0 : fromPesewas(Math.round(acc.revenuePesawas / acc.orders)),
  }
}

function breakdownRow(
  key: string,
  label: string,
  acc: Accumulator,
  estimated: boolean,
): SalesBreakdownRow {
  const totals = accumulatorTotals(acc)
  return {
    key,
    label,
    orders: acc.orders,
    units: acc.units,
    revenue: totals.revenue,
    revenuePesawas: totals.revenuePesawas,
    cogs: totals.cogs,
    cogsPesawas: totals.cogsPesawas,
    profit: totals.profit,
    profitPesawas: totals.profitPesawas,
    estimated,
  }
}

/**
 * A receivable order as a row of the receivables table.
 */
export function toReceivableOrderRow(order: SalesSummaryOrderInput, now: Date): ReceivableOrderRow {
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)
  // Whole Accra calendar days between the sale day and today. An order made
  // today is 0 days old.
  const ageDays = Math.max(0, accraDayCount(createdAt, now) - 1)
  const channel = resolveChannel(order)
  return {
    id: order.id,
    displayNumber: salesDisplayNumber(order.id),
    customerName: salesCustomerName(order),
    customerPhone: order.customerPhone ?? null,
    channel,
    channelLabel: CHANNEL_LABELS[channel],
    total: fromPesewas(toPesewas(order.total)),
    totalPesawas: toPesewas(order.total),
    createdAt: createdAt.toISOString(),
    ageDays,
    receiptToken: order.receiptToken ?? null,
  }
}

/**
 * The receivables summary of a list of receivable rows.
 */
export function buildReceivablesSummary(rows: ReceivableOrderRow[]): ReceivablesSummary {
  const sorted = [...rows].sort((a, b) => b.ageDays - a.ageDays || b.totalPesawas - a.totalPesawas)
  const amountPesawas = sorted.reduce((sum, row) => sum + row.totalPesawas, 0)
  const oldest = sorted.length > 0 ? sorted[0] : null

  return {
    amount: fromPesewas(amountPesawas),
    amountPesawas,
    count: sorted.length,
    oldestAgeDays: oldest ? oldest.ageDays : 0,
    oldestCreatedAt: oldest ? oldest.createdAt : null,
    orders: sorted,
  }
}

/**
 * True when the order is one of the rows the summary counts.
 *
 * A counted sale is a charged, not cancelled order that passes the source
 * filter. Everything else (an unpaid manual sale, a cancelled order, an order
 * of the other source) is shown but not counted.
 */
export function countsInTotals(
  order: { paymentStatus?: string | null; status?: string | null; source?: string | null },
  source: SalesSourceFilter,
): boolean {
  if (!isCountedSale(order)) return false
  if (source !== 'ALL' && order.source !== source) return false
  return true
}

/**
 * The context a summary is built in: the period, the clock and the source
 * filter. The same context always produces the same summary.
 */
export interface SalesSummaryContext {
  from: Date
  to: Date
  now: Date
  source: SalesSourceFilter
  missingCostProducts: number
}

export interface SalesSummaryAccumulatorOptions extends SalesSummaryContext {
  /**
   * Collect the unpaid manual sales that fall in the period.
   *
   * Off for the streaming path: there the receivables come from an all-time
   * query, so a period must never limit what a vendor is still owed.
   */
  collectPeriodReceivables?: boolean
}

interface ProductAccumulator extends Accumulator {
  productId: string
  productVariantId: string | null
  productName: string
  variantLabel: string | null
}

/**
 * Build a sales summary from orders that arrive one at a time.
 *
 * The accumulator keeps running totals, so a report over 50,000 orders never
 * holds more than one order at a time. The product buckets are bounded by the
 * shop's catalogue, not by the number of orders.
 */
export class SalesSummaryAccumulator {
  private readonly context: SalesSummaryContext
  private readonly collectPeriodReceivables: boolean
  private readonly rangeStart: Date
  private readonly rangeEnd: Date
  private readonly totalsAcc: Accumulator = emptyAccumulator()
  private readonly sourceAcc: Record<SalesSource, Accumulator> = {
    ONLINE: emptyAccumulator(),
    MANUAL: emptyAccumulator(),
  }
  private readonly channelAcc = new Map<SalesChannel, Accumulator>()
  private readonly dailyAcc = new Map<string, Accumulator>()
  private readonly productAcc = new Map<string, ProductAccumulator>()
  private readonly periodReceivables: ReceivableOrderRow[] = []

  constructor(options: SalesSummaryAccumulatorOptions) {
    this.context = {
      from: options.from,
      to: options.to,
      now: options.now,
      source: options.source,
      missingCostProducts: options.missingCostProducts,
    }
    this.collectPeriodReceivables = options.collectPeriodReceivables ?? true
    this.rangeStart = accraDayStart(options.from)
    this.rangeEnd = accraDayEndExclusive(options.to)
  }

  /**
   * True when the order falls inside the period and passes the source filter.
   */
  private isInScope(order: SalesSummaryOrderInput, createdAt: Date): boolean {
    if (createdAt.getTime() < this.rangeStart.getTime()) return false
    if (createdAt.getTime() >= this.rangeEnd.getTime()) return false
    if (this.context.source !== 'ALL' && order.source !== this.context.source) return false
    return true
  }

  /**
   * Fold one order into the running totals.
   */
  add(order: SalesSummaryOrderInput): void {
    const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt)
    if (!this.isInScope(order, createdAt)) return

    if (this.collectPeriodReceivables && isReceivable(order)) {
      this.periodReceivables.push(toReceivableOrderRow(order, this.context.now))
    }

    if (!isCountedSale(order)) return

    accumulate(this.totalsAcc, order)
    accumulate(this.sourceAcc[order.source], order)

    const channel = resolveChannel(order)
    const channelBucket = this.channelAcc.get(channel) ?? emptyAccumulator()
    accumulate(channelBucket, order)
    this.channelAcc.set(channel, channelBucket)

    const dayKey = accraDayKey(createdAt)
    const dayBucket = this.dailyAcc.get(dayKey) ?? emptyAccumulator()
    accumulate(dayBucket, order)
    this.dailyAcc.set(dayKey, dayBucket)

    for (const item of order.items || []) {
      const productKey = `${item.productId}::${item.productVariantId ?? 'default'}`
      let bucket = this.productAcc.get(productKey)
      if (!bucket) {
        bucket = {
          ...emptyAccumulator(),
          productId: item.productId,
          productVariantId: item.productVariantId ?? null,
          productName: item.productName,
          variantLabel: item.variantLabel ?? null,
        }
        this.productAcc.set(productKey, bucket)
      }
      const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
      const unitCost = resolveUnitCostPesawas(order, item)
      const lineRevenue =
        order.source === 'MANUAL'
          ? toPesewas(item.price) * quantity
          : item.vendorEarnings !== null && item.vendorEarnings !== undefined
            ? toPesewas(item.vendorEarnings)
            : 0

      bucket.units += quantity
      bucket.revenuePesawas += lineRevenue
      bucket.items += 1
      if (unitCost === null) {
        bucket.missingCostItems += 1
      } else {
        bucket.itemsWithCost += 1
        bucket.cogsPesawas += unitCost * quantity
      }
    }
  }

  /**
   * The finished summary.
   *
   * `receivables` overrides the receivables the accumulator collected. The
   * streaming path passes the all-time receivables there, so a period never
   * limits what the vendor is still owed.
   */
  build(
    refunds: SalesSummaryRefundInput[] = [],
    receivables?: ReceivablesSummary | null,
  ): SalesSummaryResult {
    const { from, to, source, missingCostProducts } = this.context

    const totals = accumulatorTotals(this.totalsAcc)

    const bySource: SalesBreakdownRow[] = [
      breakdownRow('ONLINE', 'Online', this.sourceAcc.ONLINE, this.sourceAcc.ONLINE.hasOnline),
      breakdownRow('MANUAL', 'Manual', this.sourceAcc.MANUAL, false),
    ]

    const byChannel: SalesBreakdownRow[] = Array.from(this.channelAcc.entries())
      .map(([channel, acc]) => breakdownRow(channel, CHANNEL_LABELS[channel], acc, acc.hasOnline))
      .sort((a, b) => b.revenuePesawas - a.revenuePesawas || a.label.localeCompare(b.label))

    const dayKeys = accraDayKeysBetween(from, to)
    const daily: SalesDailyRow[] = dayKeys.map((date) => {
      const acc = this.dailyAcc.get(date) ?? emptyAccumulator()
      const dayTotals = accumulatorTotals(acc)
      return {
        date,
        orders: acc.orders,
        units: acc.units,
        revenue: dayTotals.revenue,
        revenuePesawas: dayTotals.revenuePesawas,
        cogs: dayTotals.cogs,
        cogsPesawas: dayTotals.cogsPesawas,
        profit: dayTotals.profit,
        profitPesawas: dayTotals.profitPesawas,
        estimated: dayTotals.estimated,
      }
    })

    const productRows: SalesProductRow[] = Array.from(this.productAcc.values()).map((bucket) => ({
      productId: bucket.productId,
      productVariantId: bucket.productVariantId,
      productName: bucket.productName,
      variantLabel: bucket.variantLabel,
      units: bucket.units,
      revenue: fromPesewas(bucket.revenuePesawas),
      revenuePesawas: bucket.revenuePesawas,
      cogs: fromPesewas(bucket.cogsPesawas),
      cogsPesawas: bucket.cogsPesawas,
      profit: fromPesewas(bucket.revenuePesawas - bucket.cogsPesawas),
      profitPesawas: bucket.revenuePesawas - bucket.cogsPesawas,
      estimated: bucket.missingCostItems > 0,
    }))

    const topProductsByUnits = [...productRows]
      .sort((a, b) => b.units - a.units || b.revenuePesawas - a.revenuePesawas)
      .slice(0, 10)

    const topProductsByProfit = [...productRows]
      .sort((a, b) => b.profitPesawas - a.profitPesawas || b.units - a.units)
      .slice(0, 10)

    const receivableSummary = receivables ?? buildReceivablesSummary(this.periodReceivables)

    const refundRows = (refunds || [])
      .filter((refund) => refund.status !== 'FAILED')
      .map((refund) => ({
        id: refund.id,
        orderId: refund.orderId ?? null,
        amount: fromPesewas(toPesewas(refund.amount)),
        amountPesawas: toPesewas(refund.amount),
        status: refund.status,
        createdAt: (refund.createdAt instanceof Date ? refund.createdAt : new Date(refund.createdAt)).toISOString(),
      }))

    const refundAmountPesawas = refundRows.reduce((sum, row) => sum + row.amountPesawas, 0)
    const processedAmountPesawas = refundRows
      .filter((row) => row.status === 'PROCESSED')
      .reduce((sum, row) => sum + row.amountPesawas, 0)
    const pendingAmountPesawas = refundAmountPesawas - processedAmountPesawas

    return {
      currency: 'GHS',
      range: {
        from: accraDayKey(this.rangeStart),
        to: accraDayKey(accraDayStart(to)),
        days: accraDayCount(from, to),
      },
      source,
      profitLabel: PROFIT_LABEL,
      totals,
      bySource,
      byChannel,
      topProductsByUnits,
      topProductsByProfit,
      daily,
      receivables: receivableSummary,
      refunds: {
        amount: fromPesewas(refundAmountPesawas),
        amountPesawas: refundAmountPesawas,
        processedAmount: fromPesewas(processedAmountPesawas),
        processedAmountPesawas: processedAmountPesawas,
        pendingAmount: fromPesewas(pendingAmountPesawas),
        pendingAmountPesawas: pendingAmountPesawas,
        count: refundRows.length,
        orders: refundRows.map(({ id, orderId, amount, status, createdAt }) => ({
          id,
          orderId,
          amount,
          status,
          createdAt,
        })),
      },
      coverage: {
        items: this.totalsAcc.items,
        itemsWithCost: this.totalsAcc.itemsWithCost,
        missingCostItems: this.totalsAcc.missingCostItems,
        costCoveragePercent: totals.costCoveragePercent,
        missingCostProducts,
      },
    }
  }
}

/**
 * Build the whole sales summary from raw orders.
 *
 * Pure: the same input always produces the same output, and the only clock
 * involved is the `now` the caller passes in.
 *
 * This is the single-query path. The streaming path the routes use reads the
 * same orders in batches and folds them into a SalesSummaryAccumulator, and
 * the two must always agree.
 */
export function buildSalesSummary(input: SalesSummaryInput): SalesSummaryResult {
  const accumulator = new SalesSummaryAccumulator({
    from: input.from,
    to: input.to,
    now: input.now,
    source: input.source,
    missingCostProducts: input.missingCostProducts,
  })

  for (const order of input.orders || []) {
    accumulator.add(order)
  }

  return accumulator.build(input.refunds, input.receivables)
}
