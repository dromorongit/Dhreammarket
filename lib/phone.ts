/**
 * Ghana Phone Number Normalization Utility
 * 
 * Converts Ghanaian phone numbers from local format (0XXXXXXXXX) to international format (+233XXXXXXXXX)
 * 
 * Examples:
 * 0242222222 -> +233242222222
 * 0541234567 -> +233541234567
 * +233242222222 -> +233242222222 (already normalized)
 */

// Ghana mobile network prefixes
const GHANA_MOBILE_PREFIXES = [
  '23', '50', '54', '55', '59', '20', '24', '26', '27', '28', '29'
]

/**
 * Normalizes a Ghanaian phone number to international format
 * @param phone - The phone number to normalize
 * @returns The normalized phone number in +233 format, or the original if not a valid Ghana number
 */
export function normalizeGhanaPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // If already in +233 format, return as-is
  if (cleaned.startsWith('+233') && cleaned.length === 13) {
    return cleaned
  }

  // If starts with 233 (without +), add the +
  if (cleaned.startsWith('233') && cleaned.length === 12) {
    return `+${cleaned}`
  }

  // If starts with 0, convert to +233
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    const prefix = cleaned.substring(0, 3) // Get first 3 digits (e.g., 024, 054)
    if (GHANA_MOBILE_PREFIXES.includes(prefix.substring(1))) { // Check if it's a valid Ghana mobile prefix
      return `+233${cleaned.substring(1)}`
    }
  }

  // Return original if no transformation applied
  return phone
}

/**
 * Formats a phone number for display
 * @param phone - The phone number to format
 * @returns The formatted phone number for display
 */
export function formatGhanaPhoneNumber(phone: string | null | undefined): string {
  const normalized = normalizeGhanaPhoneNumber(phone)
  if (!normalized) return ''
  
  // Format as +233 XX XXX XXXX
  if (normalized.startsWith('+233') && normalized.length === 13) {
    return `${normalized.substring(0, 4)} ${normalized.substring(4, 6)} ${normalized.substring(6, 9)} ${normalized.substring(9)}`
  }
  
  return normalized
}

/**
 * Generates a WhatsApp link from a phone number
 * @param phone - The phone number
 * @returns WhatsApp link in format https://wa.me/233XXXXXXXXX
 */
export function getWhatsAppLink(phone: string | null | undefined): string | null {
  const normalized = normalizeGhanaPhoneNumber(phone)
  if (!normalized) return null
  
  // Remove the + for WhatsApp link
  const waNumber = normalized.replace('+', '')
  return `https://wa.me/${waNumber}`
}

/**
 * Generates a tel: link from a phone number
 * @param phone - The phone number
 * @returns tel: link
 */
export function getTelLink(phone: string | null | undefined): string | null {
  const normalized = normalizeGhanaPhoneNumber(phone)
  if (!normalized) return null
  
  return `tel:${normalized}`
}