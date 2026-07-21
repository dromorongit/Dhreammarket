export const GA_MEASUREMENT_ID = 'G-QCL4XW5FR1'

declare global {
  interface Window {
    gtag?: (...args: any[]) => void
  }
}

export const pageview = (url: string) => {
  if (typeof window.gtag !== 'function') return
  window.gtag('config', GA_MEASUREMENT_ID, { page_path: url })
}

export const event = ({ action, category, label, value }: { action: string; category: string; label?: string; value?: number }) => {
  if (typeof window.gtag !== 'function') return
  window.gtag('event', action, { event_category: category, event_label: label, value })
}