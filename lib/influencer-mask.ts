export interface MaskedReferral {
  id: string
  refereeId: string
  refereeEmail: string
  refereeName: string
  refereeRole: string
  codeUsed: string
  qualified: boolean
  qualifiedAt: string | null
  incentiveAmount: number | null
  incentivePaid: boolean
  incentivePaidAt: string | null
  createdAt: string
}

export type PrivacyMode = 'full' | 'influencer'

export function maskReferral(referral: MaskedReferral, mode: PrivacyMode): MaskedReferral {
  if (mode === 'full') {
    return referral
  }

  const firstName = referral.refereeName.split(' ')[0] || referral.refereeName
  const maskedName = firstName

  const emailParts = referral.refereeEmail.split('@')
  const maskedEmail = emailParts.length === 2
    ? `${emailParts[0][0]}***@${emailParts[1]}`
    : '***@***'

  const maskedPhone = '***'

  return {
    ...referral,
    refereeName: maskedName,
    refereeEmail: maskedEmail,
  }
}

export function applyPrivacyMask<T extends MaskedReferral>(referrals: T[], mode: PrivacyMode): T[] {
  return referrals.map((r) => maskReferral(r, mode) as T)
}
