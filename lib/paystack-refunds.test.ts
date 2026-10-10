import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

// lib/paystack.ts captures the secret key as a module-scope const, so the
// environment has to be set before the module is imported.
const TEST_KEY = 'sk_test_unit_test_key_never_logged_0001'

let listPaystackRefunds: typeof import('@/lib/paystack').listPaystackRefunds
let createPaystackRefund: typeof import('@/lib/paystack').createPaystackRefund
let fetchPaystackRefund: typeof import('@/lib/paystack').fetchPaystackRefund

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = TEST_KEY
  const mod = await import('@/lib/paystack')
  listPaystackRefunds = mod.listPaystackRefunds
  createPaystackRefund = mod.createPaystackRefund
  fetchPaystackRefund = mod.fetchPaystackRefund
})

describe('Paystack refund client', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    process.env.PAYSTACK_SECRET_KEY = TEST_KEY
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  describe('listPaystackRefunds (step A2)', () => {
    it('GETs /refund?reference=<transaction reference> with the bearer token', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Refunds retrieved',
          data: [
            {
              id: 72310594,
              amount: 5000,
              currency: 'GHS',
              status: 'processed',
              transaction_reference: 'DHV-ABC123',
              createdAt: '2026-10-01T10:00:00.000Z',
            },
          ],
        }),
      })

      const result = await listPaystackRefunds('DHV-ABC123')

      expect(result.success).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.paystack.co/refund?reference=DHV-ABC123')
      expect(init.method).toBe('GET')
      expect(init.headers.Authorization).toBe(`Bearer ${TEST_KEY}`)
      // A GET must never carry a request body.
      expect(init.body).toBeUndefined()

      expect(result.refunds).toHaveLength(1)
      expect(result.refunds[0].id).toBe(72310594)
      expect(result.refunds[0].amount).toBe(5000)
      expect(result.refunds[0].status).toBe('processed')
      expect(result.refunds[0].transactionReference).toBe('DHV-ABC123')
      expect(result.refunds[0].createdAt).toBe('2026-10-01T10:00:00.000Z')
    })

    it('URL-encodes the transaction reference', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: true, data: [] }),
      })

      await listPaystackRefunds('DHV-ABC 123+&x')

      const [url] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.paystack.co/refund?reference=DHV-ABC%20123%2B%26x')
    })

    it('reads the transaction reference defensively from data.transaction.reference', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: [
            {
              id: 99,
              amount: 2500,
              currency: 'GHS',
              status: 'pending',
              transaction: { reference: 'DHV-NESTED' },
              createdAt: '2026-10-02T08:30:00.000Z',
            },
          ],
        }),
      })

      const result = await listPaystackRefunds('DHV-NESTED')

      expect(result.refunds[0].transactionReference).toBe('DHV-NESTED')
    })

    it('tolerates refunds with no reference at all', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: [{ id: 5, amount: 100, currency: 'GHS', status: 'failed', createdAt: null }],
        }),
      })

      const result = await listPaystackRefunds('DHV-ANY')

      expect(result.refunds).toHaveLength(1)
      expect(result.refunds[0].transactionReference).toBeNull()
      expect(result.refunds[0].createdAt).toBeNull()
      expect(result.refunds[0].status).toBe('failed')
    })

    it('returns an empty list when data is not an array', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: true, data: null }),
      })

      const result = await listPaystackRefunds('DHV-EMPTY')

      expect(result.success).toBe(true)
      expect(result.refunds).toEqual([])
    })

    it('returns an API_ERROR result instead of throwing on a non-2xx response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ status: false, message: 'Unauthorized' }),
      })

      const result = await listPaystackRefunds('DHV-BAD')

      expect(result.success).toBe(false)
      expect(result.refunds).toEqual([])
      expect(result.error?.code).toBe('API_ERROR')
      expect(result.error?.httpStatus).toBe(401)
      expect(result.error?.message).toBe('Unauthorized')
    })

    it('reports NOT_CONFIGURED without calling fetch when the key is missing', async () => {
    const previous = process.env.PAYSTACK_SECRET_KEY
    delete process.env.PAYSTACK_SECRET_KEY
    vi.resetModules()
    const { listPaystackRefunds: listWithoutKey } = await import('@/lib/paystack')
    fetchMock.mockClear()

    const result = await listWithoutKey('DHV-NOCONF')

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('NOT_CONFIGURED')
    expect(fetchMock).not.toHaveBeenCalled()

    process.env.PAYSTACK_SECRET_KEY = previous
  })
  })

  describe('createPaystackRefund', () => {
    it('POSTs to /refund with pesewas and normalises the response', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: {
            id: 724,
            amount: 12345,
            currency: 'GHS',
            status: 'pending',
            transaction_reference: 'DHV-CREATE',
            createdAt: '2026-10-03T09:00:00.000Z',
          },
        }),
      })

      const result = await createPaystackRefund('DHV-CREATE', 12_345, {
        customerNote: 'Sorry!',
        merchantNote: 'Admin refund',
      })

      expect(result.success).toBe(true)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.paystack.co/refund')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe(`Bearer ${TEST_KEY}`)
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(init.body)).toEqual({
        transaction: 'DHV-CREATE',
        amount: 12345,
        currency: 'GHS',
        customer_note: 'Sorry!',
        merchant_note: 'Admin refund',
      })

      expect(result.refund?.id).toBe(724)
      expect(result.refund?.transactionReference).toBe('DHV-CREATE')
    })

    it('returns an API_ERROR result rather than throwing', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ status: false, message: 'Amount exceeds remaining balance' }),
      })

      const result = await createPaystackRefund('DHV-CREATE', 999999)

      expect(result.success).toBe(false)
      expect(result.refund).toBeUndefined()
      expect(result.error?.code).toBe('API_ERROR')
      expect(result.error?.message).toBe('Amount exceeds remaining balance')
    })

    it('aborts and reports TIMEOUT when Paystack never responds', async () => {
      vi.useFakeTimers()
      fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          )
        })
      )

      const pending = createPaystackRefund('DHV-SLOW', 500)
      const assertion = expect(pending).resolves.toMatchObject({
        success: false,
        error: { code: 'TIMEOUT' },
      })
      await vi.advanceTimersByTimeAsync(16_000)
      await assertion
    })
  })

  describe('fetchPaystackRefund', () => {
    it('GETs /refund/<id> and URL-encodes the id', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: true, data: { id: 77, amount: 100, currency: 'GHS', status: 'processed' } }),
      })

      const result = await fetchPaystackRefund('77')

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.paystack.co/refund/77')
      expect(init.method).toBe('GET')
      expect(result.refund?.id).toBe(77)
    })
  })

  describe('secret handling', () => {
    it('emits exactly one boolean-only configuration line and never logs the secret key', async () => {
      // A fresh module instance so the one-time line is emitted inside this test.
      vi.resetModules()
      const mod = await import('@/lib/paystack')

      const consoleCalls: string[] = []
      const record = (...args: unknown[]) => consoleCalls.push(args.map(String).join(' '))
      const spies = ['log', 'info', 'warn', 'error', 'debug'].map((level) =>
        vi.spyOn(console, level as 'log').mockImplementation(record as never)
      )

      try {
        // Successful create: nothing but the configuration line.
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: true, data: { id: 1, amount: 500, currency: 'GHS', status: 'processed' } }),
        })
        await mod.createPaystackRefund('DHV-SECRET', 5, { customerNote: 'note', merchantNote: 'merchant' })

        // Failed create: error path.
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ status: false, message: 'boom' }),
        })
        await mod.createPaystackRefund('DHV-SECRET', 5)

        // Failed list.
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ status: false, message: 'nope' }),
        })
        await mod.listPaystackRefunds('DHV-SECRET')

        // Successful list.
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: true, data: [{ id: 2, amount: 500, currency: 'GHS', status: 'processed' }] }),
        })
        await mod.listPaystackRefunds('DHV-SECRET')

        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ status: false, message: 'bad key' }),
        })
        await mod.fetchPaystackRefund(2)
      } finally {
        spies.forEach((spy) => spy.mockRestore())
      }

      const everything = consoleCalls.join('\n')
      // Exactly one line for the whole run, and it is boolean-only.
      expect(consoleCalls).toHaveLength(1)
      expect(consoleCalls[0]).toBe('[Paystack] Configured: true')
      // No key material of any kind: not the key, not a prefix, not a length.
      expect(everything).not.toContain(TEST_KEY)
      expect(everything).not.toContain('sk_test_unit')
      expect(everything).not.toContain('sk_test')
      expect(everything).not.toContain('customer_note')
      expect(everything).not.toContain('merchantNote')
      expect(everything).not.toContain('"amount":500')
      expect(everything).not.toContain('DHV-SECRET')
    })

    it('logs configured:false when the secret key is missing', async () => {
      vi.resetModules()
      const previous = process.env.PAYSTACK_SECRET_KEY
      delete process.env.PAYSTACK_SECRET_KEY
      const mod = await import('@/lib/paystack')

      const consoleCalls: string[] = []
      const record = (...args: unknown[]) => consoleCalls.push(args.map(String).join(' '))
      const spy = vi.spyOn(console, 'log').mockImplementation(record as never)

      try {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
        await mod.listPaystackRefunds('DHV-NOKEY')
      } finally {
        spy.mockRestore()
        process.env.PAYSTACK_SECRET_KEY = previous
      }

      expect(consoleCalls).toEqual(['[Paystack] Configured: false'])
    })
  })
})
