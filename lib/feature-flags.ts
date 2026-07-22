export function isEmailServiceEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_EMAIL_SERVICE_ENABLED
  if (value === undefined || value === null) return false
  return value.toLowerCase() === 'true'
}
