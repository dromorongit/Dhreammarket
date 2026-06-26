import { getPrisma } from '../lib/prisma'

async function auditVendorOnboarding() {
  const prisma = getPrisma()
  
  console.log('=== Vendor Onboarding Audit Report ===\n')
  console.log('Reporting vendors where store exists AND categoryId IS NULL\n')
  
  try {
    const vendors = await prisma.store.findMany({
      where: {
        categoryId: null,
      },
      select: {
        id: true,
        name: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })
    
    if (vendors.length === 0) {
      console.log('No vendors found with incomplete onboarding (store without category).\n')
      console.log('PASS: All vendors with stores have categories assigned.\n')
    } else {
      console.log(`Found ${vendors.length} vendor(s) with incomplete onboarding:\n`)
      console.log('Vendor ID | Store ID | Store Name | User Email')
      console.log('----------|----------|------------|----------------')
      
      for (const vendor of vendors) {
        console.log(`${vendor.user.id} | ${vendor.id} | ${vendor.name} | ${vendor.user.email}`)
      }
      
      console.log(`\nFAIL: ${vendors.length} vendor(s) have stores without category assigned.\n`)
    }
    
  } catch (error) {
    console.error('Error running audit:', error)
  } finally {
    await prisma.$disconnect()
  }
}

auditVendorOnboarding()