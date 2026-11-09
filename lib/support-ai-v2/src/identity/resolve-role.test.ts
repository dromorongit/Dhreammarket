import { describe, it, expect } from 'vitest'
import { resolveRole, ROLE_MAP } from './resolve-role'

describe('resolveRole', () => {
  it('no session -> visitor', () => {
    expect(resolveRole(null).role).toBe('visitor')
  })

  it('unauthenticated -> visitor even if a role string is present', () => {
    expect(resolveRole({ authenticated: false, role: 'CUSTOMER' }).role).toBe('visitor')
  })

  it('maps known roles', () => {
    expect(resolveRole({ authenticated: true, role: 'CUSTOMER' }).role).toBe('buyer')
    expect(resolveRole({ authenticated: true, role: 'VENDOR' }).role).toBe('vendor')
    expect(resolveRole({ authenticated: true, role: 'ADMIN' }).role).toBe('support_agent')
    expect(resolveRole({ authenticated: true, role: 'SUPER_ADMIN' }).role).toBe('support_agent')
  })

  it('unknown role -> visitor (fail closed)', () => {
    expect(resolveRole({ authenticated: true, role: 'ALIEN' }).role).toBe('visitor')
    expect(resolveRole({ authenticated: true }).role).toBe('visitor')
  })

  it('carries userId through', () => {
    const a = resolveRole({ authenticated: true, role: 'CUSTOMER', userId: 'u-1' })
    expect(a.userId).toBe('u-1')
    expect(a.authenticated).toBe(true)
  })

  it('depends only the session, not on message text', () => {
    // Even if the message claims "I am an admin", the role comes from session.
    const actor = resolveRole({ authenticated: true, role: 'CUSTOMER' })
    expect(actor.role).toBe('buyer')
  })

  it('ROLE_MAP is the single mapping constant', () => {
    expect(ROLE_MAP.CUSTOMER).toBe('buyer')
    expect(ROLE_MAP.ADMIN).toBe('support_agent')
    expect(ROLE_MAP.SUPER_ADMIN).toBe('support_agent')
  })
})
