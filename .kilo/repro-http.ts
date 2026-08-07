import 'dotenv/config'
import http from 'http'
import crypto from 'crypto'
import path from 'path'

// Pin Paystack env to the mock BEFORE requiring any app module that imports lib/paystack.
const PAYSTACK_BASE_URL = 'http://127.0.0.1:54323'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_validformatkey12345678901234567890'
process.env.PAYSTACK_BASE_URL = PAYSTACK_BASE_URL
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

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
      res.end(JSON.stringify({ status: true, message: 'init', data: { authorization_url: `https://mock-paystack/checkout/${ref}`, access_code: `acc_${ref}`, reference: ref } }))
    } else if (url.startsWith('/transaction/verify/') && req.method === 'GET') {
      const ref = url.split('/').pop()
      const tx = paystackTxs[ref]
      if (!tx) {
        res.end(JSON.stringify({ status: true, message: 'verify', data: { reference: ref, status: 'failed', amount: 0, currency: 'GHS', metadata: {} } }))
        return
      }
      res.end(JSON.stringify({ status: true, message: 'verify', data: { reference: ref, amount: tx.amount, currency: tx.currency, status: 'success', customer: { email: 't@e.com', first_name: 'T', last_name: 'E', phone: null }, metadata: tx.metadata } }))
    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ status: false, message: 'Not found' }))
    }
  })
})

function startServer(): Promise<void> {
  return new Promise((resolve, reject) => { server.on('error', reject); server.listen(54323, '127.0.0.1', () => resolve()) })
}
function stopServer(): Promise<void> { return new Promise((resolve) => server.close(() => resolve())) }

async function main() {
  await startServer()
  console.log('[http] Mock Paystack listening on', PAYSTACK_BASE_URL)

  // Require app modules AFTER env is pinned so lib/paystack picks up the mock.
  const { getPrisma } = require('../lib/prisma')
  const { NextRequest, NextResponse } = require('next/server')
  const { POST } = require('../app/api/subscription/billing/route')
  const jwt = require('jsonwebtoken')
  const bcrypt = require('bcryptjs')

  const prisma = getPrisma()
  const email = `httptest-${Date.now()}@example.com`
  const password = await bcrypt.hash('Test1234!', 10)

  const user = await prisma.user.create({ data: { email, password, role: 'VENDOR', status: 'ACTIVE' } })
  await prisma.store.create({ data: { userId: user.id, name: 'Http Test Store', slug: `httptest-store-${user.id}` } })
  await prisma.vendorSubscription.deleteMany({ where: { vendorId: user.id } })

  const sessionId = crypto.randomBytes(32).toString('hex')
  await prisma.session.create({ data: { sessionId, userId: user.id, isExpired: false } })
  const token = jwt.sign({ userId: user.id, role: 'VENDOR', sessionId }, process.env.JWT_SECRET, { expiresIn: '7d' })
  console.log('[http] created test vendor', user.id, 'token present:', !!token)

  function api(body: any) {
    const req = new NextRequest('http://localhost:3000/api/subscription/billing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: `token=${token}` },
      body: JSON.stringify(body),
    })
    return POST(req)
  }

  try {
    // 1) Initialize payment (upgrade to Business, price 199 GHS from DB)
    const resInit = await api({ action: 'initializePayment', planName: 'Business', billingCycle: 'MONTHLY' })
    const initJson = await resInit.json()
    console.log('[http] INIT status=', resInit.status, 'body=', JSON.stringify(initJson))
    if (resInit.status !== 200) throw new Error('init should return 200')
    if (!initJson.authorizationUrl) throw new Error('init missing authorizationUrl')
    if (initJson.amount !== 199 || initJson.currency !== 'GHS') throw new Error(`unexpected amount/currency ${initJson.amount} ${initJson.currency}`)
    if (!initJson.reference) throw new Error('init missing reference')
    console.log('[http] PASS: init returns authorizationUrl (Paystack checkout opens)')

    // 2) Verify payment (server-side verification)
    const resVerify = await api({ action: 'verifyPayment', reference: initJson.reference })
    const verifyJson = await resVerify.json()
    console.log('[http] VERIFY status=', resVerify.status, 'body=', JSON.stringify(verifyJson))
    if (resVerify.status !== 200) throw new Error('verify should return 200')
    if (!verifyJson.success || verifyJson.upgraded !== true) throw new Error('verify should upgrade')

    const sub = await prisma.vendorSubscription.findUnique({ where: { vendorId: user.id }, include: { plan: true } })
    console.log('[http] sub after verify:', JSON.stringify({ plan: sub?.plan?.name, status: sub?.status, totalPaid: sub?.totalPaid }))
    if (sub?.plan?.name !== 'Business' || sub?.status !== 'ACTIVE') throw new Error('subscription not upgraded to Business ACTIVE')
    console.log('[http] PASS: successful payment upgraded subscription to Business/ACTIVE')

    // 3) Idempotency: duplicate verify must not re-upgrade
    const resDup = await api({ action: 'verifyPayment', reference: initJson.reference })
    const dupJson = await resDup.json()
    console.log('[http] DUP verify:', JSON.stringify(dupJson))
    if (dupJson.upgraded !== false) throw new Error('duplicate verify should not re-upgrade')
    console.log('[http] PASS: duplicate verification is idempotent')

    // 4) Unauthenticated (no token) -> 401
    const reqNoAuth = new NextRequest('http://localhost:3000/api/subscription/billing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'initializePayment', planName: 'Business' }),
    })
    const resNoAuth = await POST(reqNoAuth)
    console.log('[http] no-auth status=', resNoAuth.status)
    if (resNoAuth.status !== 401) throw new Error('unauthenticated should be 401')
    console.log('[http] PASS: unauthenticated upgrade -> 401')

    // 5) Invalid plan -> safe error (not generic 500 with no info)
    const resBadPlan = await api({ action: 'initializePayment', planName: 'DoesNotExist', billingCycle: 'MONTHLY' })
    const badJson = await resBadPlan.json()
    console.log('[http] invalid-plan status=', resBadPlan.status, 'body=', JSON.stringify(badJson))
    if (resBadPlan.status !== 500 || !badJson.error) throw new Error('invalid plan should return safe error')
    console.log('[http] PASS: invalid plan -> safe error message (not masked 500)')

    console.log('[http] ALL HTTP ROUTE ASSERTIONS PASSED')
  } finally {
    await prisma.session.deleteMany({ where: { userId: user.id } })
    await prisma.vendorSubscription.deleteMany({ where: { vendorId: user.id } })
    await prisma.subscriptionInvoice.deleteMany({ where: { subscription: { vendorId: user.id } } })
    await prisma.subscriptionPayment.deleteMany({ where: { subscription: { vendorId: user.id } } })
    await prisma.subscriptionHistory.deleteMany({ where: { subscription: { vendorId: user.id } } })
    await prisma.store.deleteMany({ where: { userId: user.id } })
    await prisma.notification.deleteMany({ where: { userId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
    await prisma.$disconnect()
    await stopServer()
    console.log('[http] cleanup done')
  }
}

main().catch((e) => { console.error('[http] FAILURE:', e); process.exit(1) })
