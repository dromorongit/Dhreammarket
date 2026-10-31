import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isTrustProfileEnabled } from '@/lib/feature-flags'

describe('isTrustProfileEnabled', () => {
  afterEach(() => {
    delete process.env.TRUST_PROFILE_ENABLED
  })

  it('true', () => {
    process.env.TRUST_PROFILE_ENABLED = 'true'
    expect(isTrustProfileEnabled()).toBe(true)
  })
  it('TRUE', () => {
    process.env.TRUST_PROFILE_ENABLED = 'TRUE'
    expect(isTrustProfileEnabled()).toBe(true)
  })
  it(' spaced true ', () => {
    process.env.TRUST_PROFILE_ENABLED = ' true '
    expect(isTrustProfileEnabled()).toBe(true)
  })
  it('false', () => {
    process.env.TRUST_PROFILE_ENABLED = 'false'
    expect(isTrustProfileEnabled()).toBe(false)
  })
  it('unset', () => {
    delete process.env.TRUST_PROFILE_ENABLED
    expect(isTrustProfileEnabled()).toBe(false)
  })
  it('empty', () => {
    process.env.TRUST_PROFILE_ENABLED = ''
    expect(isTrustProfileEnabled()).toBe(false)
  })
  it('garbage', () => {
    process.env.TRUST_PROFILE_ENABLED = 'yes'
    expect(isTrustProfileEnabled()).toBe(false)
  })
})
