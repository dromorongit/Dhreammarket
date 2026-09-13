import type { SupportEngineConfig, SupportChatRequest, SupportChatResponse } from './types'
import { DEFAULT_SUPPORT_ENGINE_CONFIG } from './types'
import { matchIntent, CONFIDENCE_THRESHOLD } from './intent-matcher'
import { supportKnowledgeBase, WHATSAPP_SUPPORT_LINK, SUPPORT_EMAIL } from './knowledge-base'
import { lookupOrderStatus, lookupVendorPayoutStatus, formatOrderStatusMessage, formatVendorPayoutMessage } from './dynamic-lookups'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { supportAICache } from './cache'

function generateSessionId(): string {
  return `sup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export class SupportEngine {
  private config: SupportEngineConfig

  constructor(config?: SupportEngineConfig) {
    this.config = { ...DEFAULT_SUPPORT_ENGINE_CONFIG, ...config }
  }

  async chat(request: SupportChatRequest, token?: string): Promise<SupportChatResponse> {
    const message = request.message.trim()
    if (!message) {
      return {
        intentMatched: false,
        response: 'Please type a question so I can help you.',
        confidence: 0,
        suggestedEscalation: false,
      }
    }

    let userRole: 'CUSTOMER' | 'VENDOR' | 'ADMIN' | 'SUPER_ADMIN' | 'GUEST' = 'CUSTOMER'
    let userId: string | undefined

    if (token) {
      const outcome = await verifyToken(token)
      if (outcome.authenticated) {
        userRole = outcome.role
        userId = outcome.userId
      }
    }

    const cacheKey = `${userRole}:${message.toLowerCase().slice(0, 200)}`
    const cached = supportAICache.get<SupportChatResponse>('chat', { cacheKey })
    if (cached) return cached

    const result = await this.processMessage(message, userRole, userId)

    supportAICache.set('chat', { cacheKey }, result)
    return result
  }

  private async processMessage(
    message: string,
    userRole: string,
    userId?: string
  ): Promise<SupportChatResponse> {
    const { intent, confidence } = matchIntent(message, userRole as any)

    if (!intent || confidence < CONFIDENCE_THRESHOLD) {
      return {
        intentMatched: false,
        confidence: confidence ?? 0,
        suggestedEscalation: true,
        response: `I'm not quite sure how to answer that. For detailed help, please reach out to our support team directly:\n\n• WhatsApp: ${WHATSAPP_SUPPORT_LINK}\n• Email: ${SUPPORT_EMAIL}\n\nYou can also browse our FAQ page at /faq for common questions.`,
      }
    }

    let response = intent.response

    if (intent.isDynamic) {
      if (!userId) {
        return {
          intentMatched: true,
          confidence,
          suggestedEscalation: false,
          response: 'Please log in to your account so I can look up your specific order or payout information. Once logged in, just ask again and I\'ll pull up the details for you.',
        }
      }

      try {
        if (intent.dynamicType === 'order_status') {
          const results = await lookupOrderStatus(userId)
          response = formatOrderStatusMessage(results)
        } else if (intent.dynamicType === 'vendor_payout_status') {
          const vendorStore = await this.getVendorStoreId(userId)
          if (!vendorStore) {
            return {
              intentMatched: true,
              confidence,
              suggestedEscalation: false,
              response: 'No active vendor store found for your account. Please complete vendor onboarding to access payout information, or contact support at ' + WHATSAPP_SUPPORT_LINK,
            }
          }
          const payoutData = await lookupVendorPayoutStatus(vendorStore)
          response = formatVendorPayoutMessage(payoutData)
        }
      } catch {
        return {
          intentMatched: true,
          confidence,
          suggestedEscalation: true,
          response: `I encountered an issue looking up that information. Please try again later or contact our support team:\n\n• WhatsApp: ${WHATSAPP_SUPPORT_LINK}\n• Email: ${SUPPORT_EMAIL}`,
        }
      }
    }

    return {
      intentMatched: true,
      response,
      confidence,
      suggestedEscalation: false,
    }
  }

  private async getVendorStoreId(userId: string): Promise<string | null> {
    const prisma = getPrisma()
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { id: true },
    })
    return store?.id ?? null
  }
}

let globalEngine: SupportEngine | null = null

export function getSupportEngine(config?: SupportEngineConfig): SupportEngine {
  if (!globalEngine) {
    globalEngine = new SupportEngine(config)
  }
  return globalEngine
}

export function resetSupportEngine(): void {
  globalEngine = null
}
