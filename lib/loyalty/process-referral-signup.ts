import { getPrisma } from '@/lib/prisma'
import { completeReferral } from './referral-engine'
import { ReferralStatus } from '@prisma/client'
import { randomUUID } from 'crypto'

interface ProcessReferralSignupInput {
  referralCode: string | null | undefined
  userId: string
  registrationIpAddress: string | null
  role: string
}

export async function processReferralSignup(input: ProcessReferralSignupInput): Promise<void> {
  const prisma = getPrisma()
  const { referralCode, userId, registrationIpAddress, role } = input

  if (role !== 'CUSTOMER' || typeof referralCode !== 'string' || !referralCode.trim()) {
    return
  }

  const trimmedCode = referralCode.trim()

  const referrer = await prisma.user.findUnique({
    where: { referralCode: trimmedCode },
    select: { id: true, registrationIpAddress: true },
  })

  if (!referrer) {
    console.warn(`Invalid referral code at registration: "${trimmedCode}" for new user ${userId}`)
    return
  }

  if (referrer.id === userId) {
    return
  }

  const referrerIp = referrer.registrationIpAddress || null
  const isSameIp = registrationIpAddress && referrerIp && registrationIpAddress === referrerIp

  if (isSameIp) {
    console.warn(`Referral flagged – same IP as referrer: referrer=${referrer.id}, referee=${userId}, ip=${registrationIpAddress}`)
    return
  }

  const existing = await prisma.referralRecord.findFirst({
    where: {
      referrerId: referrer.id,
      refereeId: userId,
    },
  })

  if (existing) {
    return
  }

  const newCode = `REF-${randomUUID().slice(0, 8).toUpperCase()}`

  await prisma.referralRecord.create({
    data: {
      referrerId: referrer.id,
      refereeId: userId,
      code: newCode,
      status: ReferralStatus.PENDING,
    },
  })

  await completeReferral({
    referralCode: newCode,
    refereeId: userId,
  })
}
