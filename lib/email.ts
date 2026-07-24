import { getPlatformName, getDefaultCurrency, getPlatformPreferences, getBrandingPreferences } from './platform-preferences'

const BREVO_API_KEY = process.env.BREVO_API_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL

function getAppUrl(): string {
  if (!APP_URL) {
    console.error('[Email] CRITICAL ERROR: APP_URL is not configured. Set NEXT_PUBLIC_APP_URL or APP_URL environment variable.')
  }
  return APP_URL || 'http://localhost:3000'
}

export async function getSupportEmail(): Promise<string> {
  try {
    const prefs = await getPlatformPreferences()
    const branding = prefs.brandingPreferences
    if (branding && branding.supportEmail) return branding.supportEmail
  } catch {
    // silent
  }
  return 'support@dhreamarket.com'
}

function getEmailColors(branding: Record<string, any>) {
  const headerColor = branding.emailHeaderColor || branding.primaryColor || '#1a1a2e'
  const headerTextColor = branding.emailHeaderTextColor || '#ffffff'
  const subheaderColor = branding.emailSubheaderColor || '#6b7280'
  const footerTextColor = branding.emailFooterBackgroundColor || '#6b7280'
  const footerMutedText = branding.emailFooterBackgroundColor || '#9ca3af'
  return {
    pageBg: branding.emailBackgroundColor || '#f8f9fa',
    cardBg: branding.emailBackgroundColor || '#ffffff',
    borderColor: branding.emailBorderColor || '#e5e7eb',
    headerText,
    subheaderText: subheaderColor,
    footerBg: branding.emailFooterBackgroundColor || '#f9fafb',
    footerText: footerTextColor,
    footerMutedText,
    statusColors: {
      PROCESSING: branding.statusColors?.PROCESSING || '#1d4ed8',
      SHIPPED: branding.statusColors?.SHIPPED || '#7c3aed',
      DELIVERED: branding.statusColors?.DELIVERED || '#0891b2',
      COMPLETED: branding.statusColors?.COMPLETED || '#16a34a',
      CANCELLED: branding.statusColors?.CANCELLED || '#dc2626',
    },
    statusBg: {
      PROCESSING: branding.statusBackgrounds?.PROCESSING || '#dbeafe',
      SHIPPED: branding.statusBackgrounds?.SHIPPED || '#ede9fe',
      DELIVERED: branding.statusBackgrounds?.DELIVERED || '#cffafe',
      COMPLETED: branding.statusBackgrounds?.COMPLETED || '#dcfce7',
      CANCELLED: branding.statusBackgrounds?.CANCELLED || '#fee2e2',
    },
    buttonGradient: branding.primaryGradient || 'linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%)',
  }
}

async function getEmailLogo(fallback?: string): Promise<string> {
  try {
    const branding = await getBrandingPreferences()
    if (branding && branding.logoUrl) return branding.logoUrl
  } catch {
    // silent
  }
  return fallback || '/assets/images/dhreammarket.png'
}

interface EmailParams {
  to: string
  subject: string
  htmlContent: string
  textContent?: string
  replyTo?: string
}

export async function sendEmail({ to, subject, htmlContent, textContent, replyTo }: EmailParams) {
  if (!BREVO_API_KEY) {
    console.log(`[Email Mock] Would send to ${to}: ${subject}`)
    return { success: false, reason: 'Brevo API key not configured' }
  }

  try {
    const emailPayload: any = {
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent: textContent || htmlContent.replace(/<[^>]*>/g, ''),
    }

    if (replyTo) {
      emailPayload.replyTo = { email: replyTo }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify(emailPayload),
    })

    if (response.ok) {
      console.log(`Email sent successfully to ${to}`)
      return { success: true }
    } else {
      const errorText = await response.text()
      console.error('Brevo API error:', errorText)
      return { success: false, error: errorText }
    }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}

// Base email template wrapper for consistent styling
export async function getEmailTemplate(content: string, footerText = '', platformName?: string) {
  const name = platformName || await getPlatformName()
  const branding = await getBrandingPreferences()
  const tagline = branding.tagline || 'Smart Commerce Ecosystem'
  const supportEmail = branding.supportEmail || 'support@dhreamarket.com'
  const headerColor = branding.emailHeaderColor || branding.primaryColor || '#1a1a2e'
  const headerTextColor = branding.emailHeaderTextColor || '#ffffff'
  const pageBg = branding.emailBackgroundColor || '#f8f9fa'
  const cardBg = branding.emailBackgroundColor || '#ffffff'
  const borderColor = branding.emailBorderColor || '#e5e7eb'
  const footerBg = branding.emailFooterBackgroundColor || '#f9fafb'
  const logoUrl = branding.logoUrl || '/assets/images/dhreammarket.png'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${pageBg};">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${pageBg}; padding: 20px 0;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: ${cardBg}; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td style="padding: 24px; border-bottom: 1px solid ${borderColor}; background-color: ${headerColor};">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <img src="${logoUrl}" alt="${name} Logo" style="height: 40px; width: auto; border-radius: 4px;" onerror="this.style.display='none'" />
                  <div>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: ${headerTextColor};">${name}</h1>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: ${branding.emailSubheaderColor || '#9ca3af'};">${tagline}</p>
                  </div>
                </div>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td style="padding: 32px 24px;">
                ${content}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding: 24px; border-top: 1px solid ${borderColor}; background-color: ${footerBg}; border-radius: 0 0 8px 8px;">
                <p style="margin: 0; font-size: 12px; color: #6b7280; text-align: center;">
                  ${footerText || `This is an automated message from ${name}. Please do not reply to this email.`}
                </p>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center;">
                  &copy; 2026 ${name}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `
}

// Order confirmation email - refined
export async function sendOrderConfirmationEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  total: number,
  currency: string
) {
  const subject = `Order Confirmed - #${orderId.slice(0, 8)}`
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">Thank you for your order!</h2>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">Your order has been confirmed and is being processed. Here are the details:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Order ID</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">#${orderId.slice(0, 8)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Total Amount</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e; font-weight: 600;">${currency} ${total.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Status</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;"><span style="background-color: #dbeafe; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">Processing</span></td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">We'll notify you when your order is shipped. You can track your order status in your account.</p>
  `
  const supportEmail = await getSupportEmail()
  const htmlContent = await getEmailTemplate(content, `Questions? Contact us at ${supportEmail}`)
  
  return sendEmail({
    to: customerEmail,
    subject,
    htmlContent,
    textContent: `Dear ${customerName}, your order #${orderId.slice(0, 8)} has been confirmed. Total: ${currency} ${total.toFixed(2)}. Thank you for shopping with us!`
  })
}

// Payment confirmation email - refined
export async function sendPaymentConfirmationEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  amount: number,
  currency: string
) {
  const subject = `Payment Successful - #${orderId.slice(0, 8)}`
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">Payment Confirmed!</h2>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">Your payment has been processed successfully. Your order is now being prepared.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Order ID</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">#${orderId.slice(0, 8)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Amount Paid</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e; font-weight: 600;">${currency} ${amount.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Payment Status</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;"><span style="background-color: #dcfce7; color: #16a34a; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">Paid</span></td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Thank you for shopping with us!</p>
  `
  const supportEmail = await getSupportEmail()
  const htmlContent = await getEmailTemplate(content, `Questions? Contact us at ${supportEmail}`)
  
  return sendEmail({
    to: customerEmail,
    subject,
    htmlContent,
    textContent: `Payment of ${currency} ${amount.toFixed(2)} for order #${orderId.slice(0, 8)} has been confirmed. Thank you!`
  })
}

// Order status update email - refined
export async function sendOrderStatusUpdateEmail(
  customerEmail: string,
  customerName: string,
  orderId: string,
  newStatus: string
) {
  const statusMessages: Record<string, string> = {
    PROCESSING: 'Your order is being prepared by the vendor.',
    SHIPPED: 'Your order has been shipped and is on its way.',
    DELIVERED: 'Your order has been delivered.',
    COMPLETED: 'Your order is complete. Thank you for shopping with us!',
    CANCELLED: 'Your order has been cancelled. A refund will be processed if applicable.'
  }
  
  const statusColors: Record<string, string> = {
    PROCESSING: '#1d4ed8',
    SHIPPED: '#7c3aed',
    DELIVERED: '#0891b2',
    COMPLETED: '#16a34a',
    CANCELLED: '#dc2626'
  }
  
  const statusBg: Record<string, string> = {
    PROCESSING: '#dbeafe',
    SHIPPED: '#ede9fe',
    DELIVERED: '#cffafe',
    COMPLETED: '#dcfce7',
    CANCELLED: '#fee2e2'
  }

  const subject = `Order Update - #${orderId.slice(0, 8)}`
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">Order Status Update</h2>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">${statusMessages[newStatus] || 'Your order status has been updated.'}</p>
    <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">Order ID</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; color: #1a1a2e;">#${orderId.slice(0, 8)}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #e5e7eb; background-color: #f9fafb; font-weight: 600; color: #374151;">New Status</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">
          <span style="background-color: ${statusBg[newStatus] || '#f3f4f6'}; color: ${statusColors[newStatus] || '#374151'}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${newStatus}</span>
        </td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Thank you for shopping with us!</p>
  `
  const supportEmail = await getSupportEmail()
  const htmlContent = await getEmailTemplate(content, `Questions? Contact us at ${supportEmail}`)
  
  return sendEmail({
    to: customerEmail,
    subject,
    htmlContent,
    textContent: `Your order #${orderId.slice(0, 8)} status is now: ${newStatus}. ${statusMessages[newStatus] || ''}`
  })
}

// Review submitted confirmation email - refined
export async function sendReviewConfirmationEmail(
  customerEmail: string,
  customerName: string,
  productName: string,
  rating: number
) {
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)
  const subject = 'Thank you for your review!'
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">Thank You for Your Review!</h2>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Thank you for reviewing <strong style="color: #1a1a2e;">${productName}</strong>!</p>
    <div style="margin: 24px 0; padding: 16px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 32px; color: #f59e0b;">${stars}</p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">${rating} out of 5 stars</p>
    </div>
    <p style="margin: 0; font-size: 14px; color: #6b7280;">Your feedback helps other customers make informed decisions and helps vendors improve their products.</p>
  `
  const htmlContent = await getEmailTemplate(content)
   
   return sendEmail({
     to: customerEmail,
     subject,
     htmlContent,
   textContent: `Thank you for reviewing ${productName}! Your rating: ${rating} stars. Your feedback helps other customers!`
    })
  }

// Email verification OTP email
export async function sendEmailVerificationEmail(
  userEmail: string,
  userName: string,
  otp: string,
  expiresAt: Date
) {
  const expiryMinutes = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60))
   
  const subject = 'Your Verification Code'
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">Verify Your Email</h2>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${userName},</p>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">Thank you for registering! Please use the verification code below to verify your email address:</p>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e; font-family: 'Courier New', monospace;">${otp}</span>
    </div>
    
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Important:</strong> This code will expire in ${expiryMinutes} minute(s). For security reasons, this code can only be used once.
      </p>
    </div>
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      If you didn't create an account with us, please ignore this email.
    </p>
    
    <p style="margin: 16px 0 0 0; font-size: 14px; color: #6b7280;">
      Didn't receive the code? You can request a new one from the verification page.
    </p>
  `
  const supportEmail = await getSupportEmail()
  const htmlContent = await getEmailTemplate(content, `If you need assistance, contact our support team at ${supportEmail}`)
  
  return sendEmail({
    to: userEmail,
    subject,
    htmlContent,
    textContent: `Your verification code is: ${otp}. This code expires in ${expiryMinutes} minute(s).`
  })
}

// Password reset email - professional elite design
export async function sendPasswordResetEmail(
  customerEmail: string,
  customerName: string,
  selector: string,
  secretToken: string,
  expiresAt: Date
) {
  const resetUrl = `${getAppUrl()}/reset-password/${selector}/${secretToken}`
  const expiryHours = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))
  
  const subject = 'Reset Your Password'
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">Reset Your Password</h2>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">We received a request to reset your password for your account. Click the button below to create a new password:</p>
    
    <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${resetUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #1a1a2e 0%, #2d3561 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(26, 26, 46, 0.3);">
            Reset Password
          </a>
        </td>
      </tr>
    </table>
    
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Important:</strong> This link will expire in ${expiryHours} hour(s). For security reasons, this link can only be used once.
      </p>
    </div>
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      If you didn't request a password reset, please ignore this email. Your account will remain secure.
    </p>
  `
  const supportEmail = await getSupportEmail()
  const htmlContent = await getEmailTemplate(content, `If you need assistance, contact our support team at ${supportEmail}`)

  return sendEmail({
    to: customerEmail,
    subject,
    htmlContent,
    textContent: `Reset your password by visiting: ${resetUrl}. This link expires in ${expiryHours} hour(s).`
  })
 }

// Password changed notification email
export async function sendPasswordChangedEmail(
  customerEmail: string,
  customerName: string
) {
  const subject = 'Your Password Was Changed'
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a1a2e;">Password Changed Successfully</h2>
    <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
    <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151;">Your password has been changed successfully. If you made this change, no further action is required.</p>
    
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        <strong>Important:</strong> If you did not change your password, please contact our support team immediately or use the forgot password feature to secure your account.
      </p>
    </div>
    
    <p style="margin: 24px 0 0 0; font-size: 14px; color: #6b7280;">
      Thank you for using our platform.
    </p>
  `
  const supportEmail = await getSupportEmail()
  const htmlContent = await getEmailTemplate(content, `If you need assistance, contact our support team at ${supportEmail}`)
  
  return sendEmail({
    to: customerEmail,
    subject,
    htmlContent,
    textContent: `Your password was changed successfully. If you did not make this change, please contact support immediately.`
  })
}