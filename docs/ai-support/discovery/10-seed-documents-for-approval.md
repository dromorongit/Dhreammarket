# Seed Documents for Approval (Stage I - Non-Policy DRAFT)

Generated for founder review. All documents below are seeded as **DRAFT**, version **1**, and must not be approved/published by code. Verify wording is copied verbatim from existing site sources before approval.

## Exclusions applied
- Excluded policy topics: returns, refunds and refund timing, cancellation, payouts and payout timing, commission and fees, manual orders, account deletion or privacy requests.
- Excluded any fee, percentage, or timing promise except vendor verification review time (1-2 business days).
- Preorder/backorder content includes "how they work" only (no cancellation/refund rules).

## Seeded documents (consolidated to satisfy 1 document per intent per version)

### 1. Payment methods and payment guidance
- **Slug:** `buyer-payment-methods-guidance`
- **Intent:** `buyer.payment_methods_info`
- **Status/Version:** DRAFT / 1
- **Source:** `app/faq/faq-client.tsx:64-66; app/help/making-payments/page.tsx:38-66`
- **Flag:** contains number/promise? **Yes** — "256-bit SSL encryption"

**Full verbatim content:**
```text
We accept all major credit/debit cards, mobile money, and bank transfers through Paystack, our secure payment processor.

Dhream Market uses Paystack for secure payment processing. All payments are processed securely with industry-standard encryption.

Mobile Money

Pay directly from your MTN, Vodafone, or AirtelTigo mobile money wallet. Funds are deducted instantly.

Credit/Debit Cards

Visa, Mastercard, American Express, and other major cards accepted. Your card details are securely processed by Paystack.

Bank Transfer

Choose direct bank transfer for manual payment. Follow the provided instructions to complete your transfer.

How to Pay

- Select your preferred payment method at checkout
- Enter required payment details
- Confirm payment amount and authorize transaction
- Receive payment confirmation and order summary
```

### 2. Delivery and delivery expectations
- **Slug:** `buyer-delivery-expectations`
- **Intent:** `buyer.delivery_info`
- **Status/Version:** DRAFT / 1
- **Source:** `app/faq/faq-client.tsx:85-87; app/help/tracking-orders/page.tsx:66-83`
- **Flag:** contains number/promise? **Yes** — "3-7 business days"

**Full verbatim content:**
```text
Delivery times vary by seller location and shipping method. Standard delivery typically takes 3-7 business days. You'll receive tracking information once your order ships.

Tracking Information

Tracking Number

Once shipped, you'll receive a tracking number. Click it to view real-time carrier updates.

Delivery Updates

Receive email and SMS notifications about your order status changes.

Estimated Delivery Time

Delivery estimates vary by shipping method and vendor location. Check your order details for the expected date.
```

### 3. Track your order
- **Slug:** `buyer-order-tracking`
- **Intent:** `buyer.track_order_info`
- **Status/Version:** DRAFT / 1
- **Source:** `app/faq/faq-client.tsx:36-38; app/help/tracking-orders/page.tsx:33-50`
- **Flag:** contains number/promise? **No**

**Full verbatim content:**
```text
Go to your Dashboard > Orders. Click on any order to see its current status. You can also track order updates through email notifications.

Accessing Your Orders

Step 1: Login to Your Account

Navigate to the login page and enter your credentials to access your dashboard.

Step 2: Go to Orders Section

From your dashboard, click on "Orders" in the navigation menu or visit /dashboard/customer/orders.

Step 3: View Order Details

Click on any order to see its current status, timeline, and tracking information.
```

### 4. Account help and contact human support
- **Slug:** `account-help-general`
- **Intent:** `account.help_general`
- **Status/Version:** DRAFT / 1
- **Source:** `app/faq/faq-client.tsx:134-136; app/help/creating-account/page.tsx:38-54; app/contact/page.tsx:189-221; lib/support-ai/knowledge-base.ts:72,278,280`
- **Flag:** contains number/promise? **Yes** — "1 hour", "at least 8 characters", phone numbers, "9:00 AM - 6:00 PM (GMT)", WhatsApp URL contains numbers

**Full verbatim content:**
```text
Click "Forgot Password" on the login page. Enter your email address and follow the reset link sent to your inbox. The link expires in 1 hour.

Account Creation Process

Step 1: Navigate to Registration

Click the "Sign Up" button in the top right corner of the homepage or visit /register directly.

Step 2: Enter Email and Password

Enter your email address and create a secure password. Your password must be at least 8 characters.

Step 3: Select Account Type

Choose "Customer" if you want to shop on our marketplace. Vendors should select "Vendor" for selling.

Step 4: Verify Email

Check your inbox for a verification email and click the link to confirm your account.

Contact human support

Email Support
For general inquiries and support
support@dhreamarket.com

Phone Support
Available Monday to Friday, 9:00 AM - 6:00 PM (GMT)
+233 59 652 2239
+233 50 854 8181
+233 27 935 4362

You can also reach our support team via WhatsApp at https://wa.me/447869840464/
```

### 5. About Dhream Market
- **Slug:** `about-dhream-market`
- **Intent:** `general.about_platform`
- **Status/Version:** DRAFT / 1
- **Source:** `app/about/page.tsx:27-30; app/about/page.tsx:52-54`
- **Flag:** contains number/promise? **No**

**Full verbatim content:**
```text
The trusted home of Ghanaian trade online. We are dedicated to connecting vendors and customers through a seamless, secure, and modern e-commerce platform.

Dhream Market is the trusted home of Ghanaian trade online — built for the SMEs and shoppers who power our economy every day.
```

### 6. How to order, preorders, and backorders
- **Slug:** `buyer-how-to-order-preorders-backorders`
- **Intent:** `buyer.how_to_order`
- **Status/Version:** DRAFT / 1
- **Source:** `app/faq/faq-client.tsx:29-31; app/help/preorders/page.tsx:38-66; app/help/backorders/page.tsx:38-66`
- **Flag:** contains number/promise? **No**

**Full verbatim content:**
```text
Browse products, add items to your cart, then proceed to checkout. Select your payment method (Paystack), enter shipping details, and complete the payment. You'll receive an order confirmation via email.

Understanding Preorders

What Are Preorders?

Preorder items are products that will be available in the future. They allow vendors to gauge demand and ensure adequate stock.

When you place a preorder, you'll be charged immediately and the item will ship once it arrives at the vendor's warehouse.

Preorder Process

Step 1: Place Preorder

Select a preorder item and complete checkout. Payment is processed immediately.

Step 2: Confirmation

You receive an order confirmation with estimated arrival date and preorder terms.

Step 3: Wait for Arrival

The vendor receives the product and prepares it for shipment.

Step 4: Shipment

Once ready, your order ships and you receive tracking information.

Understanding Backorders

What Are Backorders?

Backorder items are temporarily out of stock but will be restocked soon. This allows you to reserve items in advance.

When you place a backorder, you'll be charged immediately and the item will ship once inventory is replenished.

Backorder Process

Step 1: Place Backorder

Select a backorder item and complete checkout. Payment is processed immediately.

Step 2: Confirmation

You receive an order confirmation with expected restock date.

Step 3: Restock Notification

You'll receive a notification when the item is back in stock.

Step 4: Shipment

Your order ships and you receive tracking information.
```

### 7. Vendor onboarding and verification documents
- **Slug:** `vendor-onboarding-and-verification`
- **Intent:** `vendor.onboarding_guide`
- **Status/Version:** DRAFT / 1
- **Source:** `app/faq/faq-client.tsx:43-45; app/help/vendor-verification/page.tsx:51-82`
- **Flag:** contains number/promise? **Yes** — "1-2 business days" (vendor verification review time; allowed exception)

**Full verbatim content:**
```text
Register an account and select "Vendor" as your role. Complete your profile, set up your store, and submit your store for verification. Our team will review your application within 1-2 business days.

Required Documents

For All Vendors

- Valid government-issued ID (passport, driver's license, or national ID)
- Proof of business address

For Registered Businesses

- Business registration certificate
- Business license (if applicable)

Verification Process

Step 1: Document Upload

Navigate to Vendor Dashboard > Verification and upload clear photos of required documents.

Step 2: Review

Our team reviews your submission within 1-2 business days. You'll receive email updates.

Step 3: Approval

Once approved, your store goes live and you can start selling immediately.
```

### 8. Vendor store setup and inventory management
- **Slug:** `vendor-store-setup-and-inventory`
- **Intent:** `vendor.store_management_guide`
- **Status/Version:** DRAFT / 1
- **Source:** `app/help/creating-store/page.tsx:38-66; app/help/managing-inventory/page.tsx:38-72`
- **Flag:** contains number/promise? **Yes** — "1-2 business days" (vendor verification review time; allowed exception)

**Full verbatim content:**
```text
Getting Started

To create a store, you must first register as a vendor on Dhream Market. During registration, select "Vendor" as your role.

Navigate to your Vendor Dashboard and click "Store Setup" to begin the process.

Store Setup Process

Step 1: Store Information

Enter your store name, description, and contact information in the Store Setup section.

Step 2: Business Details

Provide your business address, operating hours, and social media links.

Step 3: Store Branding

Upload your store logo and banner image to personalize your storefront.

Step 4: Verification Submission

Submit your store for verification. Our team will review within 1-2 business days.

Inventory Management Features

Real-Time Tracking

Stock levels update automatically as orders are placed and fulfilled.

Low Stock Alerts

Set minimum stock thresholds to receive notifications when inventory runs low.

Bulk Updates

Update multiple products' stock levels simultaneously through the bulk edit feature.

Managing Stock Levels

Manual Updates

Navigate to Vendor Dashboard > Products, click "Edit" and update stock quantities.

Inventory History

View stock movement history including sales, returns, and adjustments.

Setting Thresholds

Configure low stock alerts in Settings to notify you when inventory drops below set levels.
```

### 9. Product listing steps and management
- **Slug:** `vendor-product-listing-guide`
- **Intent:** `vendor.listing_guide`
- **Status/Version:** DRAFT / 1
- **Source:** `app/faq/faq-client.tsx:50-52; app/help/managing-products/page.tsx:38-72`
- **Flag:** contains number/promise? **Yes** — "30 days"

**Full verbatim content:**
```text
Navigate to your Vendor Dashboard > Products. Click "Add Product", fill in product details, upload images via Cloudinary, set pricing and stock, then publish.

Adding New Products

Step 1: Access Products Page

Navigate to Vendor Dashboard > Products and click "Add Product".

Step 2: Enter Product Details

Fill in product name, description, price, and select appropriate categories.

Step 3: Upload Images

Upload high-quality images via Cloudinary. Include multiple angles and details.

Step 4: Set Stock and Pricing

Set initial stock quantity and confirm pricing. Toggle "Publish" to make product live.

Managing Existing Products

Editing Products

Click "Edit" on any product to modify details, pricing, or images.

Stock Management

Update stock quantities manually or enable inventory tracking for automatic updates.

Status Control

Toggle "Published" to hide/show products. Deleted products can be recovered within 30 days.
```

## Support contact details found in site code (for founder review)
| Channel | Value | Source file:line |
| --- | --- | --- |
| Support email | `support@dhreamarket.com` | `lib/support-ai/knowledge-base.ts:280`, `app/contact/page.tsx:199-200,268` |
| WhatsApp link | `https://wa.me/447869840464/` | `lib/support-ai/knowledge-base.ts:72,278`, `components/support-ai/support-chat-widget.tsx:8,38,171` |
| Phone | `+233 59 652 2239` | `app/contact/page.tsx:219`, `app/help/vendor-verification/page.tsx:144` (and other help pages) |
| Phone | `+233 50 854 8181` | `app/contact/page.tsx:220`, `app/help/vendor-verification/page.tsx:146` (and other help pages) |
| Phone | `+233 27 935 4362` | `app/contact/page.tsx:221`, `app/help/vendor-verification/page.tsx:148` (and other help pages) |

**Flag (v1 bot):** v1 bot/support AI fallback uses a **UK (+44)** WhatsApp number: `https://wa.me/447869840464/` (`lib/support-ai/knowledge-base.ts:72,278`; `components/support-ai/support-chat-widget.tsx:38,171`). Contact page/help pages list **Ghana (+233)** phone numbers. Founder should confirm the canonical human-support WhatsApp/phone channel for seeded content.
