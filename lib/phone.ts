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

// All valid Ghana mobile prefixes (the 2-digit prefix after the leading 0)
const GHANA_MOBILE_PREFIXES = [
  '20', '23', '24', '25', '26', '27', '28', '29',  // Major networks
  '50', '53', '54', '55', '59'  // Other networks
]

/**
 * Sanitizes a phone number by removing spaces, dashes, brackets, and leading/trailing whitespace
 * @param phone - The phone number to sanitize
 * @returns The sanitized phone number
 */
export function sanitizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null
  return phone
    .replace(/\s+/g, '')  // Remove all spaces
    .replace(/-/g, '')    // Remove dashes
    .replace(/\(/g, '')    // Remove opening brackets
    .replace(/\)/g, '')   // Remove closing brackets
    .replace(/\+/g, '')   // Remove leading + for normalization
    .trim()
}

/**
 * Normalizes a Ghanaian phone number to international format
 * @param phone - The phone number to normalize
 * @returns The normalized phone number in +233 format, or null if invalid
 */
export function normalizeGhanaPhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null

  // Sanitize the phone number first (removes spaces, dashes, brackets, +)
  const cleaned = sanitizePhoneNumber(phone)
  if (!cleaned) return null

  // If already in 233 format (12 digits), add the +
  if (cleaned.startsWith('233') && cleaned.length === 12) {
    return `+${cleaned}`
  }

  // If starts with 0, convert to +233 (remove the leading 0, then add 233)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    const prefix = cleaned.substring(1, 3) // Get the 2-digit prefix (e.g., 24, 54)
    if (GHANA_MOBILE_PREFIXES.includes(prefix)) {
      return `+233${cleaned.substring(1)}`  // Remove leading 0, add 233
    }
  }

  // Return null for invalid numbers
  return null
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
  
  // Remove the + for WhatsApp link - always return 233XXXXXXXXX format
  const waNumber = normalized.replace('+', '')
  return `https://wa.me/${waNumber}`
}

/**
 * Generates WhatsApp links from comma-separated phone numbers
 * @param phoneNumbers - Comma-separated phone numbers
 * @returns Array of valid WhatsApp links
 */
export function getWhatsAppLinks(phoneNumbers: string | null | undefined): string[] {
  if (!phoneNumbers) return []
  
  // Split by comma and normalize each number
  const numbers = phoneNumbers
    .split(',')
    .map(n => n.trim())
    .filter(n => n.length > 0)
  
  return numbers
    .map(number => getWhatsAppLink(number))
    .filter((link): link is string => link !== null)
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