export type WaitlistInterest = 'Shopping' | 'Selling' | 'Both'
export type WaitlistDevice = 'Android' | 'iPhone (iOS)' | 'Both' | 'Not sure'

export interface WaitlistInput {
  full_name: string
  email: string
  phone?: string
  interest: WaitlistInterest
  device?: WaitlistDevice
  consent: boolean
  source?: string
  utm_medium?: string
  utm_campaign?: string
  website?: string // honeypot
}

export interface WaitlistErrors {
  full_name?: string
  email?: string
  phone?: string
  interest?: string
  device?: string
  consent?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function validateWaitlist(input: Partial<WaitlistInput>): WaitlistErrors {
  const errors: WaitlistErrors = {}
  const name = (input.full_name || '').trim()
  if (!name) errors.full_name = 'Full name is required'
  else if (name.length < 2) errors.full_name = 'Name must be at least 2 characters'
  else if (name.length > 80) errors.full_name = 'Name must be at most 80 characters'

  const email = (input.email || '').trim()
  if (!email) errors.email = 'Email address is required'
  else if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address'

  if (input.phone && input.phone.trim()) {
    const p = input.phone.trim()
    if (p.length < 7) errors.phone = 'Please enter a valid phone number'
  }

  if (!input.interest || !['Shopping', 'Selling', 'Both'].includes(input.interest)) {
    errors.interest = 'Please select an interest'
  }

  if (input.device && !['Android', 'iPhone (iOS)', 'Both', 'Not sure'].includes(input.device)) {
    errors.device = 'Invalid device selection'
  }

  if (!input.consent) errors.consent = 'You must agree to receive updates'

  return errors
}

export function hasErrors(errors: WaitlistErrors): boolean {
  return Object.keys(errors).length > 0
}

export function toInterestEnum(interest: WaitlistInterest): 'CUSTOMER' | 'VENDOR' {
  return interest === 'Selling' ? 'VENDOR' : 'CUSTOMER'
}

export function toInterestDb(interest: WaitlistInterest): string {
  return interest.toLowerCase()
}

export function toDeviceDb(device?: WaitlistDevice): string | null {
  if (!device) return null
  switch (device) {
    case 'Android':
      return 'android'
    case 'iPhone (iOS)':
      return 'ios'
    case 'Both':
      return 'both'
    case 'Not sure':
      return 'unknown'
    default:
      return null
  }
}
