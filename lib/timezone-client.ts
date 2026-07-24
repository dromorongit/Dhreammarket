declare global {
  interface Window {
    __PLATFORM_TIMEZONE__?: string
  }
}

export function getClientPlatformTimezone(): string {
  if (typeof window !== 'undefined' && window.__PLATFORM_TIMEZONE__) {
    return window.__PLATFORM_TIMEZONE__
  }
  return 'Africa/Accra'
}

export function formatDateForPlatformClient(date: Date | string, timezone?: string): string {
  const tz = timezone || getClientPlatformTimezone()
  return new Date(date).toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: tz,
  })
}
