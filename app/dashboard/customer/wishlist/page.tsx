import { redirect } from 'next/navigation'
import WishlistClient from './wishlist-client'

export default async function WishlistPage() {
  return <WishlistClient />
}