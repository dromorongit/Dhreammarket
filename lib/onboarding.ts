import { getPrisma } from '@/lib/prisma'

/**
 * Check if a vendor has completed onboarding (has a store with a vendor category)
 * @param userId - The user ID of the vendor
 * @returns true if vendor has a store and vendorCategoryId is set, false otherwise
 */
export async function isVendorOnboarded(userId: string): Promise<boolean> {
  try {
    const prisma = getPrisma()
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { categoryId: true }
    })

    return !!store && !!store.categoryId
  } catch (error) {
    console.error('Error checking vendor onboarding status:', error)
    // Return false on error to allow vendor to access store setup
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
  error?: string
}> {
  try {
    const prisma = getPrisma()
    const store = await prisma.store.findUnique({
      where: { userId },
      select: { categoryId: true }
    })

    const hasStore = !!store
    const hasCategory = !!(store && store.categoryId)
    
    return {
      isOnboarded: hasStore && hasCategory,
      hasStore,
      hasCategory
    }
  } catch (error) {
    console.error('Error getting vendor onboarding status:', error)
    return {
      isOnboarded: false,
      hasStore: false,
      hasCategory: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}