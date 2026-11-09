/**
 * Escalation / refusal / clarify templates.
 *
 * =====================================================================
 * DRAFT WORDING — NEEDS OWNER APPROVAL BEFORE USE WITH REAL USERS.
 * =====================================================================
 *
 * Rules these drafts must obey (enforced by a unit test):
 *  - Never promise a refund, an outcome, or a timeframe.
 *  - Never state that a decision has been made.
 *  - Never ask for passwords, OTPs, PINs or full card numbers.
 */

import type { ReasonCode } from '../types'

export const TEMPLATE_IDS = {
  ESCALATED_GENERIC: 'ESCALATED_GENERIC',
  ESCALATED_SECURITY: 'ESCALATED_SECURITY',
  ESCALATED_ACTION_REQUEST: 'ESCALATED_ACTION_REQUEST',
  REFUSED_SECURITY: 'REFUSED_SECURITY',
  REFUSED_OUT_OF_SCOPE: 'REFUSED_OUT_OF_SCOPE',
  CLARIFY_GENERIC: 'CLARIFY_GENERIC',
  CLARIFY_TOPIC: 'CLARIFY_TOPIC',
  BOUNDARY_ABUSE: 'BOUNDARY_ABUSE',
  ORDER_STATUS_OUT_OF_SCOPE: 'ORDER_STATUS_OUT_OF_SCOPE',
  FAILED_SAFE: 'FAILED_SAFE',
} as const

export type TemplateId = (typeof TEMPLATE_IDS)[keyof typeof TEMPLATE_IDS]

export const TEMPLATES: Record<TemplateId, string> = {
  ESCALATED_GENERIC:
    'Thanks for reaching out. I have passed this to a member of our team so a person can look into it properly. No action has been taken on your account here, and a teammate will follow up.',
  ESCALATED_SECURITY:
    'Thanks for reaching out. I have flagged this for a member of our team to review. For your safety we will never ask for your password, PIN, one-time code, or full card number — please keep those out of this chat.',
  ESCALATED_ACTION_REQUEST:
    'I am not able to make account, order, payment or payout changes myself, so I have passed your request to our support team for a person to handle. Nothing has been changed on your account here, and I cannot say what the outcome or the timing will be.',
  REFUSED_SECURITY:
    'I am not able to help with that request. If you are worried about the security of your account, please use the official support channel so our team can verify you properly.',
  REFUSED_OUT_OF_SCOPE:
    'I can only help with general questions about using Dhream Market. For anything account- or order-specific, please use the relevant section of the app so our team can assist you.',
  CLARIFY_GENERIC:
    'I want to make sure I understand you correctly. Could you give me a little more detail about what you need?',
  CLARIFY_TOPIC:
    'I can help with this topic. Are you asking for general information about it, or do you need help with a specific order or account issue? For your security, please keep your password, PIN, one-time code and full card number out of this chat.',
  BOUNDARY_ABUSE:
    'I am happy to help, but I would like to keep this conversation respectful. If you let me know what you actually need help with, I will do my best to point you in the right direction.',
  ORDER_STATUS_OUT_OF_SCOPE:
    'You can check your order status in your dashboard under Orders.',
  FAILED_SAFE:
    'Something went wrong on our side just now. Nothing has been changed on your account, and this has been flagged for a teammate to review. Please try again shortly.',
}

export function templateText(id: string): string {
  return TEMPLATES[id as TemplateId] ?? TEMPLATES.FAILED_SAFE
}

/** Which template should carry an escalation for a given reason (best effort). */
export function templateForReason(reason: ReasonCode): TemplateId {
  switch (reason) {
    case 'SECURITY_BLOCK':
      return 'REFUSED_SECURITY'
    case 'OUT_OF_SCOPE':
      return 'REFUSED_OUT_OF_SCOPE'
    default:
      return 'ESCALATED_GENERIC'
  }
}
