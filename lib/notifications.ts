import { getPrisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

// Helper function to create notifications (used by other parts of the app)
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string
) {
  try {
    await getPrisma().notification.create({
      data: {
        userId,
        type,
        title,
        message,
      },
    })
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}