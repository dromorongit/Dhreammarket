import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('fetchWithRetry', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('retries once after a network failure then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry')
    const p = fetchWithRetry('/x')
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 400 or 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry')
    const res = await fetchWithRetry('/x')
    expect(res.status).toBe(400)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops after 3 attempts and throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'))
    vi.stubGlobal('fetch', fetchMock)
    const { fetchWithRetry } = await import('@/lib/fetch-with-retry')
    const p = fetchWithRetry('/x').catch((e) => e)
    await vi.runAllTimersAsync()
    const err = await p
    expect(err).toBeInstanceOf(Error)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})