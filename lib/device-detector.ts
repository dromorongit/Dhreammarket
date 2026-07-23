export interface DeviceInfo {
  device: string
  browser: string
  os: string
}

export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
  if (!userAgent) {
    return {
      device: 'Unknown Device',
      browser: 'Unknown Browser',
      os: 'Unknown OS',
    }
  }

  const ua = userAgent.toLowerCase()

  let device = 'Desktop'
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/.test(ua)) {
    device = 'Mobile'
  } else if (/tablet|ipad|playbook|silk|kindle/.test(ua)) {
    device = 'Tablet'
  }

  let browser = 'Unknown Browser'
  if (ua.includes('edg/') || ua.includes('edge/')) {
    browser = 'Edge'
  } else if (ua.includes('opr/') || ua.includes('opera')) {
    browser = 'Opera'
  } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
    browser = 'Chrome'
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari'
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox'
  } else if (ua.includes('msie') || ua.includes('trident/')) {
    browser = 'Internet Explorer'
  }

  let os = 'Unknown OS'
  if (ua.includes('windows')) {
    if (ua.includes('windows nt 10')) os = 'Windows 10/11'
    else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1'
    else if (ua.includes('windows nt 6.2')) os = 'Windows 8'
    else if (ua.includes('windows nt 6.1')) os = 'Windows 7'
    else os = 'Windows'
  } else if (ua.includes('mac os x')) {
    os = 'macOS'
  } else if (ua.includes('iphone') || ua.includes('ipod')) {
    os = 'iOS'
  } else if (ua.includes('ipad')) {
    os = 'iPadOS'
  } else if (ua.includes('android')) {
    os = 'Android'
  } else if (ua.includes('linux')) {
    os = 'Linux'
  }

  return { device, browser, os }
}
