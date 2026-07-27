import * as Sentry from '@sentry/nextjs'
import { logWarn } from './logger'

const isDiagnosticsEnabled = (): boolean => {
  const env = process.env.NODE_ENV
  if (env !== 'production') return true
  return process.env.PERF_LOGGING === 'true'
}

const SLOW_REQUEST_THRESHOLD_MS = parseFloat(process.env.SLOW_REQUEST_THRESHOLD_MS || '1000')

export class PerformanceLogger {
  private startTime: number
  private prismaTotal: number
  private externalTotal: number
  private serializeTotal: number
  private method: string
  private url: string

  constructor(method: string, url: string) {
    this.startTime = performance.now()
    this.prismaTotal = 0
    this.externalTotal = 0
    this.serializeTotal = 0
    this.method = method
    this.url = url
  }

  markPrismaStart(): number {
    return performance.now()
  }

  markPrismaEnd(startMark: number): void {
    this.prismaTotal += performance.now() - startMark
  }

  markExternalServiceStart(): number {
    return performance.now()
  }

  markExternalServiceEnd(startMark: number): void {
    this.externalTotal += performance.now() - startMark
  }

  markSerializationStart(): number {
    return performance.now()
  }

  markSerializationEnd(startMark: number): void {
    this.serializeTotal += performance.now() - startMark
  }

  log(): void {
    if (!isDiagnosticsEnabled()) return
    const total = performance.now() - this.startTime
    console.log(
      `[PERF] ${this.method} ${this.url} ` +
        `total=${total.toFixed(2)}ms ` +
        `prisma=${this.prismaTotal.toFixed(2)}ms ` +
        `external=${this.externalTotal.toFixed(2)}ms ` +
        `serialize=${this.serializeTotal.toFixed(2)}ms`
    )
  }

  logWithDetail(label: string): void {
    if (!isDiagnosticsEnabled()) return
    const total = performance.now() - this.startTime
    console.log(
      `[PERF] ${label} ${this.method} ${this.url} ` +
        `total=${total.toFixed(2)}ms ` +
        `prisma=${this.prismaTotal.toFixed(2)}ms ` +
        `external=${this.externalTotal.toFixed(2)}ms ` +
        `serialize=${this.serializeTotal.toFixed(2)}ms`
    )
  }

  logSlowRequest(statusCode?: number): void {
    const total = performance.now() - this.startTime
    if (total >= SLOW_REQUEST_THRESHOLD_MS) {
      const meta: Record<string, unknown> = {
        method: this.method,
        url: this.url,
        statusCode: statusCode || 'unknown',
        totalMs: Math.round(total),
        prismaMs: Math.round(this.prismaTotal),
        externalMs: Math.round(this.externalTotal),
        serializeMs: Math.round(this.serializeTotal),
      }
      logWarn('Slow request detected', meta)

      if (process.env.SENTRY_DSN) {
        Sentry.captureMessage(`Slow API request: ${this.method} ${this.url}`, {
          level: 'warning',
          tags: { method: this.method, statusCode: String(statusCode || 'unknown') },
          extra: {
            totalMs: Math.round(total),
            prismaMs: Math.round(this.prismaTotal),
            externalMs: Math.round(this.externalTotal),
            serializeMs: Math.round(this.serializeTotal),
          },
        })
      }
    }
  }

  getTotalTime(): number {
    return performance.now() - this.startTime
  }
}
