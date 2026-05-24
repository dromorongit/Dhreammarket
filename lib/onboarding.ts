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
    return false
  }
}