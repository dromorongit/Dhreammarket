import { NotificationType } from '@prisma/client'

export function getStatusBadgeVariant(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'info'
    case 'UNDER_REVIEW':
      return 'warning'
    case 'QUOTED':
      return 'premium'
    case 'ACCEPTED':
      return 'success'
    case 'DECLINED':
      return 'danger'
    case 'IN_PROGRESS':
      return 'info'
    case 'COMPLETED':
      return 'success'
    case 'CANCELLED':
      return 'danger'
    default:
      return 'default'
  }
}

export function getNotificationTypeInfo(type: NotificationType): { title: string; message: string } {
  switch (type) {
    case 'SERVICE_REQUEST_CREATED':
      return { title: 'Service Request', message: 'A new service request has been created.' }
    case 'QUOTE_SENT':
      return { title: 'Quotation', message: 'A quotation has been sent for your service request.' }
    case 'QUOTE_ACCEPTED':
      return { title: 'Quotation Accepted', message: 'Your quotation has been accepted.' }
    case 'QUOTE_REJECTED':
      return { title: 'Quotation Rejected', message: 'Your quotation has been rejected.' }
    case 'PROJECT_STARTED':
      return { title: 'Project Started', message: 'The project has been started.' }
    case 'PROJECT_COMPLETED':
      return { title: 'Project Completed', message: 'The project has been completed.' }
    default:
      return { title: 'Notification', message: 'You have a new notification.' }
  }
}