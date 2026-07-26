const isDiagnosticsEnabled = (): boolean => {
  const env = process.env.NODE_ENV
  if (env !== 'production') return true
  return process.env.PERF_LOGGING === 'true'
}

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

  getTotalTime(): number {
    return performance.now() - this.startTime
  }
}
