import { getPrisma } from '@/lib/prisma'

const DEFAULT_STORE_NAME = 'My Store'

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
      select: { name: true, categoryId: true, location: true, mainPhoneNumber: true }
    })

    return !!store
      && !!store.categoryId
      && !!store.name
      && store.name.trim() !== ''
      && store.name.trim() !== DEFAULT_STORE_NAME
      && !!store.location
      && store.location.trim() !== ''
      && !!store.mainPhoneNumber
      && store.mainPhoneNumber.trim() !== ''
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
  error?: string
}> {
  try {
    const prisma = getPrisma()
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { name: true, categoryId: true, location: true, mainPhoneNumber: true }
    })

    const hasStore = !!store
    const hasCategory = !!(store && store.categoryId)
    const hasValidName = !!(store && store.name && store.name.trim() !== '' && store.name.trim() !== DEFAULT_STORE_NAME)
    const hasLocation = !!(store && store.location && store.location.trim() !== '')
    const hasPhone = !!(store && store.mainPhoneNumber && store.mainPhoneNumber.trim() !== '')

    return {
      isOnboarded: hasStore && hasCategory && hasValidName && hasLocation && hasPhone,
      hasStore,
      hasCategory,
      hasValidName,
      hasLocation,
      hasPhone
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
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}