import { getPrisma } from '@/lib/prisma'
import { backfillVerificationMethod } from '../../scripts/backfill-verification-method'

const url = process.env.DATABASE_URL ?? ''
let host = ''
try { host = new URL(url).hostname.toLowerCase() } catch { host = '' }
if (host !== 'localhost' && host !== '127.0.0.1') {
  throw new Error('Aborting: DATABASE_URL host is not localhost')
}

const prisma = getPrisma()

const vbDbCheck = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`
if (vbDbCheck[0]?.current_database !== 'dhream_dev') {
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
  throw new Error('Database not available for verification-backfill tests')
}

describe('verification backfill (real DB)', () => {
  const stamp = Date.now()
  let userId = ''
  let storeKycId = ''
  let storeAdminId = ''
  let storeUnverifiedId = ''
  let approvedAuditCreatedAt: Date | null = null


  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `vb-${stamp}@test.local`, password: 'x', role: 'VENDOR' },
    })
    userId = user.id

    const storeKyc = await prisma.store.create({
      data: { userId, name: `Store KYC ${stamp}`, slug: `store-kyc-${stamp}`, isVerified: true },
    })
    storeKycId = storeKyc.id

    const app = await prisma.vendorVerificationApplication.create({
      data: { vendorId: userId, storeId: storeKycId, status: 'APPROVED' },
    })
    const audit = await prisma.verificationAuditLog.create({
      data: { applicationId: app.id, action: 'ADMIN_APPROVED', adminId: userId },
    })
    approvedAuditCreatedAt = audit.createdAt

    const storeAdmin = await prisma.store.create({
      data: { userId: (await prisma.user.create({ data: { email: `vb2-${stamp}@test.local`, password: 'x', role: 'VENDOR' } })).id, name: `Store Admin ${stamp}`, slug: `store-admin-${stamp}`, isVerified: true },
    })
    storeAdminId = storeAdmin.id

    const storeUnverified = await prisma.store.create({
      data: { userId: (await prisma.user.create({ data: { email: `vb3-${stamp}@test.local`, password: 'x', role: 'VENDOR' } })).id, name: `Store Unverified ${stamp}`, slug: `store-unverified-${stamp}`, isVerified: false },
    })
    storeUnverifiedId = storeUnverified.id
  })

  afterAll(async () => {
    await prisma.store.deleteMany({ where: { id: { in: [storeKycId, storeAdminId, storeUnverifiedId] } } })
    await prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@test.local` } } })
    await prisma.$disconnect()
  })

  it('classifies stores correctly', async () => {
    await backfillVerificationMethod()

    const kyc = await prisma.store.findUnique({ where: { id: storeKycId } })
    expect(kyc?.verificationMethod).toBe('KYC')
    expect(kyc?.kycVerifiedAt?.getTime()).toBe(approvedAuditCreatedAt?.getTime())

    const admin = await prisma.store.findUnique({ where: { id: storeAdminId } })
    expect(admin?.verificationMethod).toBe('ADMIN_FLAG')
    expect(admin?.kycVerifiedAt).toBeNull()

    const unverified = await prisma.store.findUnique({ where: { id: storeUnverifiedId } })
    expect(unverified?.verificationMethod).toBe('NONE')
  })
})
