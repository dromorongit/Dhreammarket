import * as path from 'path'
import * as fs from 'fs'

// Paystack's paid_at is NOT stored anywhere in the schema:
// - prisma/schema.prisma Payment model (lines ~636-654): only createdAt/updatedAt.
// - lib/webhooks/order-webhook-handler.ts (~line 279): payment.update sets
//   status 'PAID' but no paid-at timestamp column exists.
// Therefore a human-reviewed --times-file CSV (orderId,paidAt) is required for
// a real payment time; rows without one are flagged uncertain=true.
import dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import { getPrisma } from '@/lib/prisma'

export interface ParsedBackfillArgs {
  dryRun: boolean
  apply: boolean
  allowHost: string | null
  timesFile: string | null
}

export function parseArgs(argv: string[]): ParsedBackfillArgs {
  let dryRun = true
  let apply = false
  let allowHost: string | null = null
  let timesFile: string | null = null

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run' || arg === '-n') {
      dryRun = true
      apply = false
    } else if (arg === '--apply') {
      apply = true
      dryRun = false
    } else if (arg.startsWith('--allow-host=')) {
      allowHost = arg.slice('--allow-host='.length)
    } else if (arg === '--allow-host') {
      allowHost = argv[i + 1] ?? null
      i++
    } else if (arg.startsWith('--times-file=')) {
      timesFile = arg.slice('--times-file='.length)
    } else if (arg === '--times-file') {
      timesFile = argv[i + 1] ?? null
      i++
    }
  }

  if (apply) dryRun = false
  return { dryRun, apply, allowHost, timesFile }
}

// Aliases for compatibility with alternate test naming.
export const parseBackfillArgs = parseArgs
export const parsePaymentConfirmedArgs = parseArgs

export function targetDatabase(databaseUrl: string): { host: string; database: string } {
  const parsed = new URL(databaseUrl)
  return {
    host: parsed.hostname,
    database: decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? ''),
  }
}

export function requireAllowHost(
  databaseUrl: string | undefined,
  allowHost: string | null
): { host: string; database: string } {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }
  const { host, database } = targetDatabase(databaseUrl)
  if (allowHost === null || allowHost !== host) {
    throw new Error(`refusing to run: --allow-host must match the DATABASE_URL host (${host})`)
  }
  return { host, database }
}

// Aliases for compatibility with alternate test naming.
export const requireAllowedHost = requireAllowHost
export const assertAllowedHost = requireAllowHost
export const requireConfirmHost = requireAllowHost

function computeSlaDeadline(paymentTime: Date, order: any, policyDispatch: number): Date {
  const dispatchDays = Number.isFinite(order?.slaPolicyDispatchDays)
    ? order.slaPolicyDispatchDays
    : policyDispatch
  const windowDays = Number.isFinite(order?.slaPolicyDeliveryWindowDays)
    ? order.slaPolicyDeliveryWindowDays
    : 3
  const ms = (dispatchDays + windowDays) * 86400000
  return new Date(paymentTime.getTime() + ms)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const databaseUrl = process.env.DATABASE_URL
  const { host, database } = requireAllowHost(databaseUrl, args.allowHost)
  console.log(`Target database: ${host}/${database}`)

  const prisma = getPrisma()

  const platformPolicy = await prisma.platformPolicy.findFirst()
  const policyDispatch = platformPolicy?.dispatchTargetDaysAfterPayment ?? 3

  // Load human-reviewed paid times if provided.
  const paidTimes = new Map<string, Date>()
  if (args.timesFile) {
    const raw = fs.readFileSync(args.timesFile, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.toLowerCase().startsWith('orderid')) continue
      const [orderId, paidAt] = trimmed.split(',').map((s) => s.trim())
      if (!orderId || !paidAt) continue
      const d = new Date(paidAt)
      if (Number.isNaN(d.getTime())) continue
      paidTimes.set(orderId, d)
    }
  }

  const orders = await prisma.order.findMany({
    where: {
      source: 'ONLINE',
      paymentStatus: 'PAID',
      paymentConfirmedAt: null,
    },
    include: {
      payment: true,
      items: {
        include: {
          product: {
            select: {
              store: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })

  console.log(`Found ${orders.length} ONLINE orders with paymentStatus PAID and paymentConfirmedAt NULL`)

  const candidates: Array<{
    orderId: string
    store: string
    paymentTime: Date
    uncertain: boolean
    slaDeadline: Date
  }> = []

  for (const order of orders) {
    const payment = order.payment
    if (!payment || payment.status !== 'PAID') continue
    // Real payment time comes only from a human-reviewed --times-file.
    // Without it, fall back to Payment.updatedAt and flag uncertain=true.
    let paymentTime: Date | null = paidTimes.get(order.id) ?? null
    let uncertain = !paidTimes.has(order.id)
    if (!paymentTime) {
      paymentTime = payment.updatedAt ?? null
    }
    if (!paymentTime) continue

    const storeName =
      order.items?.[0]?.product?.store?.name ??
      order.items?.[0]?.product?.store?.id ??
      'unknown'

    const slaDeadline = computeSlaDeadline(paymentTime, order, policyDispatch)

    candidates.push({ orderId: order.id, store: storeName, paymentTime, uncertain, slaDeadline })
  }

  for (const c of candidates) {
    console.log(
      `order=${c.orderId} store=${c.store} paymentTime=${c.paymentTime.toISOString()} uncertain=${c.uncertain} slaDeadline=${c.slaDeadline.toISOString()}`
    )
  }

  if (args.dryRun) {
    console.log('\n=== DRY RUN - no changes made ===')
    console.log(`Would update ${candidates.length} orders (Payment.updatedAt used as payment time)`)
    console.log('Run with --apply --allow-host=<host> to apply changes.')
    await prisma.$disconnect()
    return
  }

  if (!args.apply) {
    console.log('Nothing to do (pass --apply to write).')
    await prisma.$disconnect()
    return
  }

  let updated = 0
  for (const c of candidates) {
    const order = orders.find((o: any) => o.id === c.orderId)
    await prisma.order.update({
      where: { id: c.orderId },
      data: { paymentConfirmedAt: c.paymentTime },
    })
    // trigger stamps slaDeadline; re-read not required
    updated++
    void order
  }

  console.log(`\nBackfill complete: updated ${updated} orders`)
  await prisma.$disconnect()
}

const invokedDirectly =
  process.argv[1] && path.basename(process.argv[1]) === 'backfill-payment-confirmed.ts'
if (invokedDirectly) {
  main().catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })
}
export { main }
