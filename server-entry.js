const path = require('path')

const JWT_CODES = new Set([
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'JWTExpired',
  'JWTInvalid',
])

const jwtCounts = {}
let lastJwtLog = 0

function isJwtCode(code) {
  return JWT_CODES.has(code)
}

function logJwt(code) {
  jwtCounts[code] = (jwtCounts[code] || 0) + 1
  const now = Date.now()
  if (now - lastJwtLog >= 60000) {
    lastJwtLog = now
    const snapshot = Object.assign({}, jwtCounts)
    Object.keys(snapshot).forEach((key) => { delete jwtCounts[key] })
    console.error('[server-entry][JWT] unhandled auth rejection counts:', JSON.stringify(snapshot))
  }
}

function captureSentry(error) {
  try {
    const Sentry = require('@sentry/nextjs')
    if (Sentry && typeof Sentry.captureException === 'function') {
      Sentry.captureException(error)
    }
  } catch (_) {
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)

  let isAuthError = false
  let code
  if (reason && typeof reason === 'object') {
    code = reason.code || reason.name
    if (isJwtCode(code)) {
      isAuthError = true
    }
  }

  if (isAuthError) {
    logJwt(code)
    console.error('Auth-related unhandled rejection - process continuing')
    return
  }

  console.error('[server-entry][UNEXPECTED][unhandledRejection] Unhandled Rejection:', reason)
  captureSentry(reason)
  console.error('Non-fatal unhandled rejection - process continuing')
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)

  let isAuthError = false
  let code
  if (error && typeof error === 'object') {
    code = error.code || error.name
    if (isJwtCode(code)) {
      isAuthError = true
    }
  }

  if (isAuthError) {
    logJwt(code)
    console.error('Auth-related uncaught exception - process continuing')
    return
  }

  console.error('[server-entry][UNEXPECTED][uncaughtException] Uncaught Exception:', error)
  captureSentry(error)
  console.error('Non-fatal uncaught exception - process continuing')
})

require(path.join(__dirname, '.next', 'standalone', 'server.js'))
