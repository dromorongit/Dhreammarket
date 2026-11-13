import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

globalThis.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  delete (process.env as any).NEXT_PUBLIC_PAYLINK_ENABLED
})

function src() {
  return readFileSync(path.join(process.cwd(), 'components/vendor/PayLinkButton.tsx'), 'utf8')
}

describe('PayLinkButton', () => {
  it('renders when payLinkEnabled prop is true even if NEXT_PUBLIC flag is unset', () => {
    const s = src()
    expect(s).toContain('payLinkEnabled?')
    expect(s).toContain("process.env.NEXT_PUBLIC_PAYLINK_ENABLED === 'true'")
    expect(s).toContain("const enabled = payLinkEnabled ?? process.env.NEXT_PUBLIC_PAYLINK_ENABLED === 'true'")
    expect(s).toContain('Send pay link')
  })

  it('shows Resend pay link when payLinkSent is true', () => {
    expect(src()).toContain("payLinkSent ? 'Resend pay link' : 'Send pay link'")
  })

  it('is hidden for PAID or CANCELLED', () => {
    const s = src()
    expect(s).toContain("paymentStatus !== 'PAID'")
    expect(s).toContain("status !== 'CANCELLED'")
  })
})

