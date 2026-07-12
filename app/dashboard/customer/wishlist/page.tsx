import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'
import WishlistClient from './wishlist-client'

export default async function WishlistPage() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/login?redirect=/dashboard/customer/wishlist')
  }
  
  return <WishlistClient />
}