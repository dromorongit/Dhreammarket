const path = require('path')

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)

  let isAuthError = false
  if (reason && typeof reason === 'object') {
    const code = reason.code || reason.name
    if (
      code === 'ERR_JWT_EXPIRED' ||
      code === 'ERR_JWT_INVALID' ||
      code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
      code === 'JWTExpired' ||
      code === 'JWTInvalid'
    ) {
      isAuthError = true
    }
  }

  if (isAuthError) {
    console.error('Auth-related unhandled rejection - process continuing')
    return
  }

  console.error('Non-fatal unhandled rejection - process continuing')
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)

  let isAuthError = false
  if (error && typeof error === 'object') {
    const code = error.code || error.name
    if (
      code === 'ERR_JWT_EXPIRED' ||
      code === 'ERR_JWT_INVALID' ||
      code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' ||
      code === 'JWTExpired' ||
      code === 'JWTInvalid'
    ) {
      isAuthError = true
    }
  }

  if (isAuthError) {
    console.error('Auth-related uncaught exception - process continuing')
    return
  }

  console.error('Non-fatal uncaught exception - process continuing')
})

require(path.join(__dirname, '.next', 'standalone', 'server.js'))
