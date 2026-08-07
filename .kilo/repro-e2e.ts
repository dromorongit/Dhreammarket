import 'dotenv/config'
import http from 'http'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const PAYSTACK_BASE_URL = 'http://127.0.0.1:54321'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_validformatkey12345678901234567890'
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_public'
process.env.PAYSTACK_BASE_URL = PAYSTACK_BASE_URL

// In-memory Paystack transaction store keyed by reference
const paystackTxs: Record<string, { amount: number; currency: string; metadata: Record<string, any> }> = {}

const server = http.createServer((req, res) => {
  const url = req.url || ''
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json')
    if (url === '/transaction/initialize' && req.method === 'POST') {
      const parsed = JSON.parse(body || '{}')
      const ref = parsed.reference
      paystackTxs[ref] = { amount: parsed.amount, currency: 'GHS', metadata: parsed.metadata || {} }
      res.end(JSON.stringify({
        status: true,
        message: 'Transaction initialized',
        data: {
          authorization_url: `https://mock-paystack/checkout/${ref}`,
          access_code: `acc_${ref}`,
          reference: ref,
        },
      }))
    } else if (url.startsWith('/transaction/verify/') && req.method === 'GET') {
      const ref = url.split('/').pop()
      const tx = paystackTxs[ref]
      if (!tx) {
        res.end(JSON.stringify({ status: true, message: 'Verify no tx', data: { reference: ref, status: 'failed', amount: 0, currency: 'GHS', metadata: {} } }))
        return
      }
      res.end(JSON.stringify({
        status: true,
        message: 'Transaction verified',
        data: {
          reference: ref,
          amount: tx.amount,
          currency: tx.currency,
          status: 'success',
          customer: { email: 'test@example.com', first_name: 'Test', last_name: 'Vendor', phone: null },
          metadata: tx.metadata,
        },
      }))
    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ status: false, message: 'Not found' }))
    }
  })
})

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    server.listen(54321, '127.0.0.1', () => resolve())
  })
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()))
}

async function main() {
  await startServer()
  console.log('[repro] Mock Paystack server listening on', PAYSTACK_BASE_URL)

  // Use CommonJS require AFTER env is pinned so lib/paystack picks up the mock URL/key.
  const { getPrisma } = require('../lib/prisma')
  const { initializeBillingPayment, verifyBillingPayment } = require('../lib/subscription/billing-service')
  const { upgradeSubscription } = require('../lib/subscription/subscription-service')

  const prisma = getPrisma()
  const email = `subtest-${Date.now()}@example.com`
  const password = await bcrypt.hash('Test1234!', 10)

  // Create a dedicated VENDOR test user + store (isolated, cleaned up at the end)
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  let userId: string
  if (existing) {
    userId = existing.id
  } else {
    const user = await prisma.user.create({
      data: { email, password, role: 'VENDOR', status: 'ACTIVE' },
    })
    userId = user.id
    await prisma.store.create({ data: { userId, name: 'Test Store', slug: `test-store-${user.id}` } })
  }
  console.log('[repro] test vendor userId =', userId, 'email =', email)

  // Ensure no pre-existing subscription for this vendor
  await prisma.vendorSubscription.deleteMany({ where: { vendorId: userId } })

  try {
    // 1) Initialize Paystack payment for upgrading to Business (price 199 GHS from DB)
    const init = await initializeBillingPayment(userId, email, 'Business', 'MONTHLY')
    console.log('[repro] INIT RESULT:', JSON.stringify(init))
    if (!init.success || !init.authorizationUrl) {
      throw new Error('Init did not return authorizationUrl')
    }
    if (init.amount !== 199 || init.currency !== 'GHS') {
      throw new Error(`Unexpected amount/currency: ${init.amount} ${init.currency}`)
    }

    // Confirm DB state: invoice + pending payment exist with targetPlanName in metadata
    const payment = await prisma.subscriptionPayment.findFirst({
      where: { paystackRef: init.reference },
      include: { invoice: true },
    })
    console.log('[repro] payment record:', JSON.stringify({ id: payment.id, status: payment.status, paystackRef: payment.paystackRef, amount: payment.amount, currency: payment.currency }))
    if (!payment || payment.status !== 'PENDING' || payment.paystackRef !== init.reference) {
      throw new Error('Payment record not created correctly')
    }

    // 2) Verify payment (mock Paystack returns success with matching amount/currency)
    const verify = await verifyBillingPayment(init.reference!)
    console.log('[repro] VERIFY RESULT:', JSON.stringify(verify))
    if (!verify.success || verify.status !== 'success') {
      throw new Error('Verification did not succeed')
    }

    // 3) Confirm subscription upgraded to Business
    const sub = await prisma.vendorSubscription.findUnique({ where: { vendorId: userId }, include: { plan: true } })
    console.log('[repro] subscription after verify:', JSON.stringify({ plan: sub?.plan?.name, status: sub?.status, totalPaid: sub?.totalPaid }))
    if (sub?.plan?.name !== 'Business' || sub?.status !== 'ACTIVE') {
      throw new Error('Subscription was not upgraded to Business')
    }

    // 4) Idempotency: verify again - must NOT double-upgrade
    const verify2 = await verifyBillingPayment(init.reference!)
    console.log('[repro] DUPLICATE VERIFY RESULT:', JSON.stringify(verify2))
    if (verify2.upgraded !== false) {
      throw new Error('Duplicate verification should not re-upgrade')
    }

    // 5) History record check
    const history = await prisma.subscriptionHistory.findMany({ where: { subscriptionId: sub.id }, orderBy: { createdAt: 'desc' } })
    console.log('[repro] history actions:', history.map((h: any) => h.action))
    const hasUpgrade = history.some((h: any) => h.action === 'UPGRADED')
    const hasPayment = history.some((h: any) => h.action === 'PAYMENT_SUCCESS')
    if (!hasUpgrade || !hasPayment) throw new Error('Missing history entries')

    // 6) Notification check
    const note = await prisma.notification.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
    console.log('[repro] last notification:', JSON.stringify({ type: note?.type, title: note?.title }))

    console.log('[repro] ALL E2E ASSERTIONS PASSED')
  } finally {
    // Cleanup: delete test vendor's subscription artefacts + the user
    try {
      const tsub = await prisma.vendorSubscription.findUnique({ where: { vendorId: userId }, select: { id: true } })
      if (tsub) {
        await prisma.subscriptionHistory.deleteMany({ where: { subscriptionId: tsub.id } })
        await prisma.subscriptionPayment.deleteMany({ where: { subscriptionId: tsub.id } })
        await prisma.subscriptionInvoice.deleteMany({ where: { subscriptionId: tsub.id } })
        await prisma.subscriptionUsage.deleteMany({ where: { subscriptionId: tsub.id } })
        await prisma.vendorSubscription.delete({ where: { vendorId: userId } })
      }
      await prisma.store.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } })
      console.log('[repro] cleanup complete for vendor', userId)
    } catch (e: any) {
      console.log('[repro] cleanup note:', e.message)
    }
    await prisma.$disconnect()
    await stopServer()
    console.log('[repro] server stopped')
  }
}

main().catch((e) => { console.error('[repro] FAILURE:', e); process.exit(1) })
