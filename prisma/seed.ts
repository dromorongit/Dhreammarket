import 'dotenv/config'
import { getPrisma } from '../lib/prisma'
import { subscriptionPlans, planBenefits } from '../lib/subscription/types'
import { logInfo } from '../lib/logger'

export type SupportSeedDocument = {
  slug: string
  title: string
  intent: string
  content: string
  status: 'DRAFT'
  version: 1
  sourceNote: string
}

export const supportSeedDocuments: SupportSeedDocument[] = [
  {
    slug: 'buyer-payment-methods-guidance',
    title: 'Payment methods and payment guidance',
    intent: 'buyer.payment_methods_info',
    status: 'DRAFT',
    version: 1,
    sourceNote: 'app/faq/faq-client.tsx:64-66; app/help/making-payments/page.tsx:38-66',
    content:
      'We accept all major credit/debit cards, mobile money, and bank transfers through Paystack, our secure payment processor.\n\nDhream Market uses Paystack for secure payment processing. All payments are processed securely with industry-standard encryption.\n\nMobile Money\n\nPay directly from your MTN, Vodafone, or AirtelTigo mobile money wallet. Funds are deducted instantly.\n\nCredit/Debit Cards\n\nVisa, Mastercard, American Express, and other major cards accepted. Your card details are securely processed by Paystack.\n\nBank Transfer\n\nChoose direct bank transfer for manual payment. Follow the provided instructions to complete your transfer.\n\nHow to Pay\n\n- Select your preferred payment method at checkout\n- Enter required payment details\n- Confirm payment amount and authorize transaction\n- Receive payment confirmation and order summary',
  },
  {
    slug: 'buyer-delivery-expectations',
    title: 'Delivery and delivery expectations',
    intent: 'buyer.delivery_info',
    status: 'DRAFT',
    version: 1,
    sourceNote: 'app/faq/faq-client.tsx:85-87; app/help/tracking-orders/page.tsx:66-83',
    content:
      "Delivery times vary by seller location and shipping method. Standard delivery typically takes 3-7 business days. You'll receive tracking information once your order ships.\n\nTracking Information\n\nTracking Number\n\nOnce shipped, you'll receive a tracking number. Click it to view real-time carrier updates.\n\nDelivery Updates\n\nReceive email and SMS notifications about your order status changes.\n\nEstimated Delivery Time\n\nDelivery estimates vary by shipping method and vendor location. Check your order details for the expected date.",
  },
  {
    slug: 'buyer-order-tracking',
    title: 'Track your order',
    intent: 'buyer.track_order_info',
    status: 'DRAFT',
    version: 1,
    sourceNote: 'app/faq/faq-client.tsx:36-38; app/help/tracking-orders/page.tsx:33-50',
    content:
      'Go to your Dashboard > Orders. Click on any order to see its current status. You can also track order updates through email notifications.\n\nAccessing Your Orders\n\nStep 1: Login to Your Account\n\nNavigate to the login page and enter your credentials to access your dashboard.\n\nStep 2: Go to Orders Section\n\nFrom your dashboard, click on "Orders" in the navigation menu or visit /dashboard/customer/orders.\n\nStep 3: View Order Details\n\nClick on any order to see its current status, timeline, and tracking information.',
  },
  {
    slug: 'account-help-general',
    title: 'Account help and contact human support',
    intent: 'account.help_general',
    status: 'DRAFT',
    version: 1,
    sourceNote:
      'app/faq/faq-client.tsx:134-136; app/help/creating-account/page.tsx:38-54; app/contact/page.tsx:189-221; lib/support-ai/knowledge-base.ts:72,278,280',
    content:
      'Click "Forgot Password" on the login page. Enter your email address and follow the reset link sent to your inbox. The link expires in 1 hour.\n\nAccount Creation Process\n\nStep 1: Navigate to Registration\n\nClick the "Sign Up" button in the top right corner of the homepage or visit /register directly.\n\nStep 2: Enter Email and Password\n\nEnter your email address and create a secure password. Your password must be at least 8 characters.\n\nStep 3: Select Account Type\n\nChoose "Customer" if you want to shop on our marketplace. Vendors should select "Vendor" for selling.\n\nStep 4: Verify Email\n\nCheck your inbox for a verification email and click the link to confirm your account.\n\nContact human support\n\nEmail Support\nFor general inquiries and support\nsupport@dhreamarket.com\n\nPhone Support\nAvailable Monday to Friday, 9:00 AM - 6:00 PM (GMT)\n+233 59 652 2239\n+233 50 854 8181\n+233 27 935 4362\n\nYou can also reach our support team via WhatsApp at https://wa.me/447869840464/',
  },
  {
    slug: 'about-dhream-market',
    title: 'About Dhream Market',
    intent: 'general.about_platform',
    status: 'DRAFT',
    version: 1,
    sourceNote: 'app/about/page.tsx:27-30; app/about/page.tsx:52-54',
    content:
      'The trusted home of Ghanaian trade online. We are dedicated to connecting vendors and customers through a seamless, secure, and modern e-commerce platform.\n\nDhream Market is the trusted home of Ghanaian trade online — built for the SMEs and shoppers who power our economy every day.',
  },
  {
    slug: 'buyer-how-to-order-preorders-backorders',
    title: 'How to order, preorders, and backorders',
    intent: 'buyer.how_to_order',
    status: 'DRAFT',
    version: 1,
    sourceNote:
      'app/faq/faq-client.tsx:29-31; app/help/preorders/page.tsx:38-66; app/help/backorders/page.tsx:38-66',
    content:
      "Browse products, add items to your cart, then proceed to checkout. Select your payment method (Paystack), enter shipping details, and complete the payment. You'll receive an order confirmation via email.\n\nUnderstanding Preorders\n\nWhat Are Preorders?\n\nPreorder items are products that will be available in the future. They allow vendors to gauge demand and ensure adequate stock.\n\nWhen you place a preorder, you'll be charged immediately and the item will ship once it arrives at the vendor's warehouse.\n\nPreorder Process\n\nStep 1: Place Preorder\n\nSelect a preorder item and complete checkout. Payment is processed immediately.\n\nStep 2: Confirmation\n\nYou receive an order confirmation with estimated arrival date and preorder terms.\n\nStep 3: Wait for Arrival\n\nThe vendor receives the product and prepares it for shipment.\n\nStep 4: Shipment\n\nOnce ready, your order ships and you receive tracking information.\n\nUnderstanding Backorders\n\nWhat Are Backorders?\n\nBackorder items are temporarily out of stock but will be restocked soon. This allows you to reserve items in advance.\n\nWhen you place a backorder, you'll be charged immediately and the item will ship once inventory is replenished.\n\nBackorder Process\n\nStep 1: Place Backorder\n\nSelect a backorder item and complete checkout. Payment is processed immediately.\n\nStep 2: Confirmation\n\nYou receive an order confirmation with expected restock date.\n\nStep 3: Restock Notification\n\nYou'll receive a notification when the item is back in stock.\n\nStep 4: Shipment\n\nYour order ships and you receive tracking information.",
  },
  {
    slug: 'vendor-onboarding-and-verification',
    title: 'Vendor onboarding and verification documents',
    intent: 'vendor.onboarding_guide',
    status: 'DRAFT',
    version: 1,
    sourceNote:
      'app/faq/faq-client.tsx:43-45; app/help/vendor-verification/page.tsx:51-82',
    content:
      'Register an account and select "Vendor" as your role. Complete your profile, set up your store, and submit your store for verification. Our team will review your application within 1-2 business days.\n\nRequired Documents\n\nFor All Vendors\n\n- Valid government-issued ID (passport, driver\'s license, or national ID)\n- Proof of business address\n\nFor Registered Businesses\n\n- Business registration certificate\n- Business license (if applicable)\n\nVerification Process\n\nStep 1: Document Upload\n\nNavigate to Vendor Dashboard > Verification and upload clear photos of required documents.\n\nStep 2: Review\n\nOur team reviews your submission within 1-2 business days. You\'ll receive email updates.\n\nStep 3: Approval\n\nOnce approved, your store goes live and you can start selling immediately.',
  },
  {
    slug: 'vendor-store-setup-and-inventory',
    title: 'Vendor store setup and inventory management',
    intent: 'vendor.store_management_guide',
    status: 'DRAFT',
    version: 1,
    sourceNote:
      'app/help/creating-store/page.tsx:38-66; app/help/managing-inventory/page.tsx:38-72',
    content:
      'Getting Started\n\nTo create a store, you must first register as a vendor on Dhream Market. During registration, select "Vendor" as your role.\n\nNavigate to your Vendor Dashboard and click "Store Setup" to begin the process.\n\nStore Setup Process\n\nStep 1: Store Information\n\nEnter your store name, description, and contact information in the Store Setup section.\n\nStep 2: Business Details\n\nProvide your business address, operating hours, and social media links.\n\nStep 3: Store Branding\n\nUpload your store logo and banner image to personalize your storefront.\n\nStep 4: Verification Submission\n\nSubmit your store for verification. Our team will review within 1-2 business days.\n\nInventory Management Features\n\nReal-Time Tracking\n\nStock levels update automatically as orders are placed and fulfilled.\n\nLow Stock Alerts\n\nSet minimum stock thresholds to receive notifications when inventory runs low.\n\nBulk Updates\n\nUpdate multiple products\' stock levels simultaneously through the bulk edit feature.\n\nManaging Stock Levels\n\nManual Updates\n\nNavigate to Vendor Dashboard > Products, click "Edit" and update stock quantities.\n\nInventory History\n\nView stock movement history including sales, returns, and adjustments.\n\nSetting Thresholds\n\nConfigure low stock alerts in Settings to notify you when inventory drops below set levels.',
  },
  {
    slug: 'vendor-product-listing-guide',
    title: 'Product listing steps and management',
    intent: 'vendor.listing_guide',
    status: 'DRAFT',
    version: 1,
    sourceNote:
      'app/faq/faq-client.tsx:50-52; app/help/managing-products/page.tsx:38-72',
    content:
      'Navigate to your Vendor Dashboard > Products. Click "Add Product", fill in product details, upload images via Cloudinary, set pricing and stock, then publish.\n\nAdding New Products\n\nStep 1: Access Products Page\n\nNavigate to Vendor Dashboard > Products and click "Add Product".\n\nStep 2: Enter Product Details\n\nFill in product name, description, price, and select appropriate categories.\n\nStep 3: Upload Images\n\nUpload high-quality images via Cloudinary. Include multiple angles and details.\n\nStep 4: Set Stock and Pricing\n\nSet initial stock quantity and confirm pricing. Toggle "Publish" to make product live.\n\nManaging Existing Products\n\nEditing Products\n\nClick "Edit" on any product to modify details, pricing, or images.\n\nStock Management\n\nUpdate stock quantities manually or enable inventory tracking for automatic updates.\n\nStatus Control\n\nToggle "Published" to hide/show products. Deleted products can be recovered within 30 days.',
  },
]

async function main() {
  const prisma = getPrisma()

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        priceMonthly: plan.priceMonthly ?? null,
        priceYearly: plan.priceYearly ?? null,
        productsLimit: plan.productsLimit,
        servicesLimit: plan.servicesLimit,
        isActive: true,
        benefits: JSON.stringify(planBenefits[plan.name as keyof typeof planBenefits] ?? []),
      },
      create: {
        name: plan.name,
        priceMonthly: plan.priceMonthly ?? null,
        priceYearly: plan.priceYearly ?? null,
        productsLimit: plan.productsLimit,
        servicesLimit: plan.servicesLimit,
        isActive: true,
        benefits: JSON.stringify(planBenefits[plan.name as keyof typeof planBenefits] ?? []),
      },
    })
    logInfo(`Seeded subscription plan: ${plan.name}`)
  }

  logInfo('Subscription plan seeding complete')

  // Support AI v2 knowledge base: NON-POLICY content only, seeded as DRAFT.
  // Code never approves documents; only a human approval changes status.
  // Deliberately excluded: returns, refunds/refund timing, cancellation,
  // payouts/payout timing, commission/fees, manual orders, account deletion
  // or privacy requests, and any fee/percentage/timing promise other than the
  // vendor verification review time. Do not run this seed against any database
  // without explicit approval.
  for (const doc of supportSeedDocuments) {
    const existing = await prisma.supportDocument.findUnique({ where: { slug: doc.slug } })
    if (existing) {
      logInfo(`Support document already exists, leaving status unchanged: ${doc.slug}`)
      continue
    }

    const created = await prisma.supportDocument.create({
      data: {
        slug: doc.slug,
        title: doc.title,
        content: doc.content,
        status: 'DRAFT',
        version: doc.version,
        intent: doc.intent,
      },
    })
    await prisma.documentChunk.create({
      data: { documentId: created.id, chunkIndex: 0, content: doc.content },
    })
    logInfo(`Seeded support document (DRAFT): ${doc.slug}`)
  }

  logInfo('Support AI v2 seed complete')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await getPrisma().$disconnect()
    } catch {}
  })


