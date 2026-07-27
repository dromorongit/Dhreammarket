import { performance } from 'perf_hooks'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isProduction = process.env.NODE_ENV === 'production'

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString()
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`
}

export function logDebug(message: string, meta?: Record<string, unknown>): void {
  if (!isProduction) {
    console.debug(formatMessage('debug', message, meta))
  }
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  if (!isProduction) {
    console.info(formatMessage('info', message, meta))
  }
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  console.warn(formatMessage('warn', message, meta))
}

export function logError(message: string, error?: unknown, meta?: Record<string, unknown>): void {
  const errorMeta = error instanceof Error
    ? { message: error.message, stack: isProduction ? undefined : error.stack, ...meta }
    : { error: String(error), ...meta }
  console.error(formatMessage('error', message, errorMeta))
}

export function createRequestLogger(method: string, url: string) {
  const startTime = performance.now()

  return {
    info(message: string, meta?: Record<string, unknown>): void {
      logInfo(`[${method}] ${message}`, { url, ...meta })
    },
    warn(message: string, meta?: Record<string, unknown>): void {
      logWarn(`[${method}] ${message}`, { url, ...meta })
    },
    error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
      logError(`[${method}] ${message}`, error, { url, ...meta })
    },
    end(statusCode: number): void {
      const duration = performance.now() - startTime
      if (isProduction && duration > 1000) {
        logWarn('Slow request detected', {
          method,
          url,
          statusCode,
          durationMs: Math.round(duration),
        })
      }
    },
  }
}
