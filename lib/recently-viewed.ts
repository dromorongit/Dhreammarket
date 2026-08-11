const STORAGE_KEY = 'dhream_recently_viewed'
const MAX_ITEMS = 12

export function addRecentlyViewed(productId: string) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const list: string[] = raw ? JSON.parse(raw) : []
    const filtered = list.filter((id) => id !== productId)
    filtered.unshift(productId)
    const trimmed = filtered.slice(0, MAX_ITEMS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore storage errors
  }
}

export function getRecentlyViewed(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
