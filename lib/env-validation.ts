type EnvVar = {
  key: string
  required: boolean
  secret?: boolean
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  { key: 'DATABASE_URL', required: true, secret: true },
  { key: 'JWT_SECRET', required: true, secret: true },
  { key: 'NEXT_PUBLIC_APP_URL', required: false, secret: false },
  { key: 'CLOUDINARY_CLOUD_NAME', required: false, secret: false },
  { key: 'CLOUDINARY_API_KEY', required: false, secret: true },
  { key: 'CLOUDINARY_API_SECRET', required: false, secret: true },
  { key: 'PAYSTACK_SECRET_KEY', required: false, secret: true },
  { key: 'PAYSTACK_PUBLIC_KEY', required: false, secret: false },
  { key: 'BREVO_API_KEY', required: false, secret: true },
  { key: 'BREVO_SENDER_EMAIL', required: false, secret: false },
  { key: 'SENTRY_DSN', required: false, secret: false },
  { key: 'SENTRY_AUTH_TOKEN', required: false, secret: true },
  { key: 'SENTRY_ORG', required: false, secret: false },
  { key: 'SENTRY_PROJECT', required: false, secret: false },
]

export function validateEnvironment(): void {
  const missing: string[] = []
  const warnings: string[] = []

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.key]
    if (!value || value.trim() === '') {
      if (envVar.required) {
        missing.push(envVar.key)
      } else if (process.env.NODE_ENV === 'production') {
        warnings.push(envVar.key)
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Application startup aborted.`
    )
  }

  if (warnings.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn(
      `[ENV] Production environment detected with missing optional variables: ${warnings.join(', ')}`
    )
  }
}

export function getSafeEnvInfo(): Record<string, string> {
  const info: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
    DATABASE_URL: process.env.DATABASE_URL ? 'set (hidden)' : 'not set',
    JWT_SECRET: process.env.JWT_SECRET ? 'set (hidden)' : 'not set',
    SENTRY_DSN: process.env.SENTRY_DSN || 'not set',
  }
  return info
}
