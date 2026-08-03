import { getPrisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications'
import type { NotificationType } from '@prisma/client'
import { logInfo, logError } from '@/lib/logger'

export async function sendCampaignNotification(
  userId: string,
  notificationType: string,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await createNotification(userId, notificationType as NotificationType, title, message)
    logInfo(`Campaign notification sent: user=${userId}, type=${notificationType}, title="${title}"`)
  } catch (error) {
    logError(`Failed to send campaign notification: ${error}`)
  }
}

export async function notifyCampaignSubmitted(vendorId: string, campaignTitle: string, campaignId: string): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_SUBMITTED',
    'Campaign Submitted',
    `Your campaign "${campaignTitle}" has been submitted successfully and is pending payment.`,
    { campaignId, campaignTitle }
  )
}

export async function notifyCampaignApproved(vendorId: string, campaignTitle: string, campaignId: string): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_APPROVED',
    'Campaign Approved',
    `Your campaign "${campaignTitle}" has been approved and is now active.`,
    { campaignId, campaignTitle }
  )
}

export async function notifyCampaignRejected(vendorId: string, campaignTitle: string, campaignId: string, reason: string): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_REJECTED',
    'Campaign Rejected',
    `Your campaign "${campaignTitle}" has been rejected. Reason: ${reason}`,
    { campaignId, campaignTitle, reason }
  )
}

export async function notifyCampaignActivated(vendorId: string, campaignTitle: string, campaignId: string): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_ACTIVATED',
    'Campaign Activated',
    `Your campaign "${campaignTitle}" is now active and running on the homepage.`,
    { campaignId, campaignTitle }
  )
}

export async function notifyCampaignExpiringSoon(vendorId: string, campaignTitle: string, campaignId: string, daysRemaining: number): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_EXPIRING_SOON',
    'Campaign Expiring Soon',
    `Your campaign "${campaignTitle}" will expire in ${daysRemaining} days. Consider renewing it.`,
    { campaignId, campaignTitle, daysRemaining }
  )
}

export async function notifyCampaignExpired(vendorId: string, campaignTitle: string, campaignId: string): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_EXPIRED',
    'Campaign Expired',
    `Your campaign "${campaignTitle}" has expired.`,
    { campaignId, campaignTitle }
  )
}

export async function notifyPaymentSuccessful(vendorId: string, campaignTitle: string, amount: number, paystackRef: string): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_PAYMENT_SUCCESS',
    'Payment Successful',
    `Payment of ${amount} GHS for campaign "${campaignTitle}" was successful. Reference: ${paystackRef}`,
    { campaignTitle, amount, paystackRef }
  )
}

export async function notifyPaymentFailed(vendorId: string, campaignTitle: string, amount: number): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_PAYMENT_FAILED',
    'Payment Failed',
    `Payment of ${amount} GHS for campaign "${campaignTitle}" failed. Please try again.`,
    { campaignTitle, amount }
  )
}

export async function notifyCampaignSuspended(vendorId: string, campaignTitle: string, campaignId: string): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_SUSPENDED',
    'Campaign Suspended',
    `Your campaign "${campaignTitle}" has been suspended by an administrator.`,
    { campaignId, campaignTitle }
  )
}

export async function notifyCampaignExtended(vendorId: string, campaignTitle: string, campaignId: string, newEndDate: Date): Promise<void> {
  await sendCampaignNotification(
    vendorId,
    'CAMPAIGN_EXTENDED',
    'Campaign Extended',
    `Your campaign "${campaignTitle}" has been extended until ${newEndDate.toISOString()}.`,
    { campaignId, campaignTitle, newEndDate }
  )
}

export async function checkAndNotifyExpiringCampaigns(): Promise<number> {
  const prisma = getPrisma()
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const expiringCampaigns = await prisma.advertisementCampaign.findMany({
    where: {
      campaignStatus: 'ACTIVE',
      endDate: { lte: sevenDaysFromNow, gte: now },
    },
    include: { vendor: { select: { id: true } } },
  })

  for (const campaign of expiringCampaigns) {
    const daysRemaining = Math.ceil(
      (campaign.endDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    await notifyCampaignExpiringSoon(
      campaign.vendorId,
      campaign.title,
      campaign.id,
      daysRemaining
    )
  }

  return expiringCampaigns.length
}