/**
 * Security hardening: Input sanitization utilities
 * Prevents XSS attacks by sanitizing user-provided text content
 */

// Dangerous HTML patterns to detect and remove
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
  /<meta\b[^>]*>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /javascript:\s*/gi,
  /vbscript:\s*/gi,
  /data:text\/html/gi,
]

// Allowed HTML tags for rich text (if needed in future)
const ALLOWED_TAGS: Record<string, string[]> = {
  product: [],
  store: [],
  review: [],
  support: [],
  contact: [],
}

/**
 * Strip all HTML tags and dangerous content from input
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  let sanitized = input
  
  // Remove dangerous patterns first
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '')
  }
  
  // Remove all remaining HTML tags
  sanitized = sanitized.replace(/<[^>]+>/g, '')
  
  return sanitized.trim()
}

/**
 * Sanitize input for specific content types
 */
export function sanitizeInput(input: string, contentType: keyof typeof ALLOWED_TAGS = 'product'): string {
  if (!input || typeof input !== 'string') return ''
  
  const sanitized = sanitizeHtml(input)
  
  // Additional content-specific sanitization can be added here
  return sanitized
}

/**
 * Escape HTML entities for safe output
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  }
  
  return input.replace(/[&<>"'`=\/]/g, char => map[char])
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

/**
 * Validate and sanitize phone numbers
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') return ''
  
  // Remove all non-numeric characters except + at start
  const cleaned = phone.trim().replace(/[^\d+]/g, '')
  
  // Ensure + only at start
  return cleaned.replace(/^\+/, '').length > 0 
    ? '+' + cleaned.replace(/^\+/, '') 
    : ''
}

/**
 * Strip potentially dangerous characters from text input
 */
export function stripDangerousChars(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

/**
 * Truncate input to maximum length (prevents buffer overflow in downstream systems)
 */
export function truncateInput(input: string, maxLength: number): string {
  if (!input || typeof input !== 'string') return ''
  if (input.length <= maxLength) return input
  return input.substring(0, maxLength).trim()
}

/**
 * Full sanitization pipeline for user-generated content
 */
export function sanitizeUserContent(
  input: string, 
  options: { 
    maxLength?: number
    contentType?: keyof typeof ALLOWED_TAGS 
  } = {}
): string {
  if (!input || typeof input !== 'string') return ''
  
  let result = input
  
  // Strip dangerous characters
  result = stripDangerousChars(result)
  
  // Remove HTML
  result = sanitizeHtml(result)
  
  // Truncate if needed
  if (options.maxLength) {
    result = truncateInput(result, options.maxLength)
  }
  
  return result.trim()
}