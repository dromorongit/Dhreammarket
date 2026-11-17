export async function fetchWithRetry(input: RequestInfo, init: RequestInit = {}, opts: { timeoutMs?: number; maxAttempts?: number } = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 15000
  const maxAttempts = opts.maxAttempts ?? 3
  let lastError: any
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      clearTimeout(timer)
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res
      }
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      clearTimeout(timer)
      lastError = err
    }
    if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
  }
  throw lastError ?? new Error('Network error')
}