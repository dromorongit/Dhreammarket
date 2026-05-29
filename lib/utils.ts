import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines class names with Tailwind CSS merge support
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Truncates vendor/store names to 25 characters with ellipsis
 * @param name - The full vendor/store name
 * @returns Truncated name with "..." if over 25 characters, otherwise original name
 */
export function truncateVendorName(name: string | null | undefined): string {
  if (!name) return ''
  if (name.length <= 25) return name
  return name.substring(0, 25) + '...'
}