import { getPrisma } from '@/lib/prisma'

const GENERIC_STORE_NAMES = new Set([
  'My Store',
  'My Shop',
  'Untitled Store',
  'Untitled Shop',
  'Store',
  'Shop'
])

function isGenericStoreName(name: string | null | undefined): boolean {
  if (!name) return true
  return GENERIC_STORE_NAMES.has(name.trim())
}

/**
 * Check if a vendor has completed onboarding (has a store with all mandatory fields)
 * @param userId - The user ID of the vendor
 * @returns true if vendor has a store with non-default name, category, location, and phone, false otherwise
 */
export async function isVendorOnboarded(userId: string): Promise<boolean> {
  try {
    const prisma = getPrisma()
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { name: true, categoryId: true, location: true, mainPhoneNumber: true, description: true, setupComplete: true }
    })

    if (!store) {
      return false
    }

    if (store.setupComplete !== null && store.setupComplete !== undefined) {
      return store.setupComplete
    }

    return !!store.categoryId
      && !!store.name
      && store.name.trim() !== ''
      && !isGenericStoreName(store.name)
      && !!store.location
      && store.location.trim() !== ''
      && !!store.mainPhoneNumber
      && store.mainPhoneNumber.trim() !== ''
      && !!store.description
      && store.description.trim() !== ''
  } catch (error) {
    console.error('Error checking vendor onboarding status:', error)
    return false
  }
}

/**
 * Get vendor onboarding status with details
 * @param userId - The user ID of the vendor
 * @returns object with onboarding status and details
 */
export async function getVendorOnboardingStatus(userId: string): Promise<{
  isOnboarded: boolean
  hasStore: boolean
  hasCategory: boolean
  hasValidName: boolean
  hasLocation: boolean
  hasPhone: boolean
  hasDescription: boolean
  error?: string
}> {
  try {
    const prisma = getPrisma()
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { name: true, categoryId: true, location: true, mainPhoneNumber: true, description: true, setupComplete: true }
    })

    const hasStore = !!store
    const hasCategory = !!(store && store.categoryId)
    const hasValidName = !!(store && store.name && store.name.trim() !== '' && !isGenericStoreName(store.name))
    const hasLocation = !!(store && store.location && store.location.trim() !== '')
    const hasPhone = !!(store && store.mainPhoneNumber && store.mainPhoneNumber.trim() !== '')
    const hasDescription = !!(store && store.description && store.description.trim() !== '')

    const isOnboarded = hasStore && hasCategory && hasValidName && hasLocation && hasPhone && hasDescription

    return {
      isOnboarded,
      hasStore,
      hasCategory,
      hasValidName,
      hasLocation,
      hasPhone,
      hasDescription
    }
  } catch (error) {
    console.error('Error getting vendor onboarding status:', error)
    return {
      isOnboarded: false,
      hasStore: false,
      hasCategory: false,
      hasValidName: false,
      hasLocation: false,
      hasPhone: false,
      hasDescription: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
