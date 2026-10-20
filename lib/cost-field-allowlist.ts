// The one list of the files that are allowed to name the vendor's money
// fields.
//
// Four columns of the commerce models are business secrets:
//
//   * Product.costPrice        - what the vendor paid for the stock
//   * ProductVariant.costPrice - the same, per variant
//   * OrderItem.costPriceSnapshot - what the line cost when it was sold
//   * Order.deliveryCost       - what the vendor paid the rider
//
// A buyer has no business seeing any of them. The guard test
// (lib/cost-field-guard.test.ts) scans app/, lib/ and components/ for those
// names and fails the build when one of them turns up in a file that is not
// listed here.
//
// HOW TO ADD AN ENTRY
// -------------------
// 1. Add the path of the file to the list that matches what the file does:
//      * COST_FIELD_ALLOWLIST       - the file may NAME the fields. It is
//        either a vendor-only route, a vendor-only page, or the library that
//        does the money math.
//      * RELATION_INCLUDE_ALLOWLIST  - the file may load a whole relation
//        with `include: { relation: true }`, which returns every column of
//        that relation.
// 2. Write the reason in the entry. A reason without a reason is not an
//    entry: the next person has to be able to tell whether the file still
//    deserves to be here.
// 3. Never add a file that a buyer can reach. A vendor is entitled to the
//    cost of their own stock; a buyer is entitled to the price they pay.
//
// The two lists are separate on purpose. A file may be allowed to name the
// fields without being allowed to load a whole relation, and the other way
// round.

export interface AllowlistEntry {
  /** The path of the file, relative to the repository root. */
  path: string
  /** Why this file is allowed to do what it does. */
  reason: string
}

/**
 * The files that may name `costPrice`, `costPriceSnapshot` or
 * `deliveryCost`.
 */
export const COST_FIELD_ALLOWLIST: AllowlistEntry[] = [  {
    path: 'lib/cost-field-allowlist.ts',
    reason:
      'This file names the fields it forbids. It is the rule, not a breach of it.',
  },
  {
    path: 'lib/public-selects.ts',
    reason:
      'The one definition of the public shape of a commerce row. It names the fields only in comments and in the negative list (FORBIDDEN_PUBLIC_FIELDS), plus in VENDOR_ORDER_ITEM_SELECT, where the vendor is entitled to the cost of their own lines. The guard test asserts that no PUBLIC_* select carries a cost field.',
  },
  {
    path: 'lib/sales-summary.ts',
    reason:
      'The money math: it validates a cost price, it holds the cost snapshot of a sold line and it folds the delivery cost of a sale into the profit. Nothing here leaves the server.',
  },
  {
    path: 'lib/vendor-sales-data.ts',
    reason:
      'The vendor-scoped loader of the money view. Every read is scoped to one store, so a vendor only ever reads the cost of their own stock.',
  },
  {
    path: 'lib/manual-orders.ts',
    reason:
      'The helpers of a manual sale. The cost snapshot of a line is part of its input, because a manual sale records the cost of the line as it is at the moment of the sale.',
  },
  {
    path: 'lib/csv.ts',
    reason:
      'The CSV builder of the vendor export. The export has a "delivery cost" column, and this is the module that writes a row of it.',
  },
  {
    path: 'app/api/vendor/manual-orders/route.ts',
    reason:
      'Vendor-only route. The vendor creates the sale and is entitled to the cost of the lines they sold.',
  },
  {
    path: 'app/api/vendor/manual-orders/[orderId]/route.ts',
    reason:
      'Vendor-only route. It sets the delivery cost of the vendor\'s own manual order.',
  },
  {
    path: 'app/api/vendor/manual-orders/[orderId]/confirm-payment/route.ts',
    reason:
      'Vendor-only route. It confirms the payment of the vendor\'s own manual order.',
  },
  {
    path: 'app/api/vendor/orders/route.ts',
    reason:
      'Vendor-only route. It reports the cost of the vendor\'s own lines, and nulls the delivery cost of a shared order.',
  },
  {
    path: 'app/api/vendor/orders/[orderId]/route.ts',
    reason:
      'Vendor-only route. It reports the delivery cost of the vendor\'s own manual order.',
  },
  {
    path: 'app/api/vendor/products/[id]/quick/route.ts',
    reason:
      'Vendor-only route. It edits the cost price of the vendor\'s own product.',
  },
  {
    path: 'app/api/vendor/products/missing-cost/route.ts',
    reason:
      'Vendor-only route. It lists the products of the vendor\'s own store that still have no cost price.',
  },
  {
    path: 'app/api/vendor/sales-summary/route.ts',
    reason:
      'Vendor-only route. It is the money view of the vendor\'s own store.',
  },
  {
    path: 'app/api/vendor/sales-summary/export/route.ts',
    reason:
      'Vendor-only route. It exports the money view of the vendor\'s own store as a CSV.',
  },
  {
    path: 'app/api/products/route.ts',
    reason:
      'Mixed file: the GET is public and must stay clean (the runtime leak test app/api/cost-field-leaks.test.ts drives it), the POST is the vendor\'s own product creation and is entitled to the cost. A cost field outside the vendor branch of this file is a leak.',
  },
  {
    path: 'app/api/products/[id]/route.ts',
    reason:
      'Mixed file: the GET is public and must stay clean (the runtime leak test app/api/cost-field-leaks.test.ts drives it), the PUT and the DELETE are the vendor\'s own product and are entitled to the cost. A cost field outside the vendor branch of this file is a leak.',
  },
  {
    path: 'app/dashboard/vendor/orders/page.client.tsx',
    reason:
      'Vendor dashboard page. The vendor edits the delivery cost of their own order here.',
  },
  {
    path: 'app/dashboard/vendor/quick-sale/page.client.tsx',
    reason:
      'Vendor dashboard page. The vendor records a manual sale, with its delivery cost, here.',
  },
  {
    path: 'app/dashboard/vendor/products/costs/page.client.tsx',
    reason:
      'Vendor dashboard page. The vendor fills in the cost price of their own products here.',
  },
  {
    path: 'app/dashboard/vendor/products/new/page.client.tsx',
    reason:
      'Vendor dashboard page. The vendor sets the cost price of their own new product here.',
  },
  {
    path: 'app/dashboard/vendor/products/[id]/edit/page.client.tsx',
    reason:
      'Vendor dashboard page. The vendor edits the cost price of their own product here.',
  },
]

/**
 * The files that may load a whole relation with `include: { relation: true }`.
 *
 * A bare `include` returns EVERY column of the included row, the cost
 * columns included. A file may only be here when the relation is loaded on
 * the server, for the vendor\'s own store, and never for a buyer.
 */
export const RELATION_INCLUDE_ALLOWLIST: AllowlistEntry[] = [
  {
    path: 'app/api/products/[id]/route.ts',
    reason:
      'The vendor-only PUT branch reloads the product with its variants to answer the vendor\'s own edit form. The public GET branch of the same file selects its fields and must stay that way.',
  },
  {
    path: 'app/api/vendor/manual-orders/route.ts',
    reason:
      'Vendor-only route. It reads the variants of the vendor\'s own products to price a manual sale, and the lines of the sale to resolve an idempotency key.',
  },
  {
    path: 'app/api/vendor/products/[id]/quick/route.ts',
    reason:
      'Vendor-only route. It reads the variants of the vendor\'s own product to edit their cost.',
  },
  {
    path: 'app/api/vendor/fulfillment/route.ts',
    reason:
      'Vendor-only route. It reads the lines of the vendor\'s own orders to answer the fulfilment screen. The lines are filtered to the products of that vendor.',
  },
  {
    path: 'app/api/admin/orders/[id]/route.ts',
    reason:
      'Admin route. The staff view of an order shows the cost of the lines.',
  },
  {
    path: 'app/api/admin/refund-requests/route.ts',
    reason:
      'Admin route. The staff list of the refund requests reads the lines of the orders.',
  },
  {
    path: 'app/api/admin/vendors/[id]/route.ts',
    reason:
      'Admin route. The staff view of a vendor reads the orders of that vendor.',
  },
  {
    path: 'app/api/super-admin/orders/[id]/route.ts',
    reason:
      'Super-admin route. The staff view of an order shows the cost of the lines.',
  },
  {
    path: 'app/api/homepage-sections/[id]/route.ts',
    reason:
      'Super-admin route. The homepage section is edited by staff, and the products it points at are staff data.',
  },
  {
    path: 'app/api/homepage-sections/[id]/products/route.ts',
    reason:
      'Super-admin route. The products of a homepage section are staff data.',
  },
  {
    path: 'lib/refunds/refund-service.ts',
    reason:
      'Server-side refund math. It reads the whole order and its lines to work out what may be refunded. Nothing it reads is sent to a buyer.',
  },
  {
    path: 'lib/stock-allocation-engine.ts',
    reason:
      'Server-side stock math. It reads the whole product and variant to work out the allocation. Nothing it reads is sent to a buyer.',
  },
  {
    path: 'lib/stock-reservation.ts',
    reason:
      'Server-side stock math. It reads the whole product and variant to reserve and release stock. Nothing it reads is sent to a buyer.',
  },
  {
    path: 'lib/webhooks/order-webhook-handler.ts',
    reason:
      'Server-side webhook handler. It reads the whole product of a line to notify the vendor. Nothing it reads is sent to a buyer.',
  },
]

/**
 * The files that may read a cost bearing model without selecting its fields.
 *
 * A Prisma read with no `select` returns EVERY column of the row, the cost
 * columns included. A file may only be here when the row is read on the
 * server, for the vendor's own store, and never for a buyer.
 */
export const COST_MODEL_READ_ALLOWLIST: AllowlistEntry[] = [
  {
    path: 'app/api/products/route.ts',
    reason:
      'The vendor-only POST branch creates the product and reads it back for the vendor\'s own edit form. The public GET branch of the same file selects its fields and must stay that way.',
  },
  {
    path: 'app/api/products/[id]/route.ts',
    reason:
      'The vendor-only PUT branch reads the product back for the vendor\'s own edit form. The public GET branch of the same file selects its fields and must stay that way.',
  },
  {
    path: 'app/api/vendor/manual-orders/route.ts',
    reason:
      'Vendor-only route. It reads the products of the vendor\'s own store to price a manual sale.',
  },
  {
    path: 'app/api/vendor/orders/[orderId]/route.ts',
    reason:
      'Vendor-only route. It reads the vendor\'s own order to answer the order screen.',
  },
  {
    path: 'app/api/vendor/products/[id]/quick/route.ts',
    reason:
      'Vendor-only route. It reads the product of the vendor\'s own store to edit its cost.',
  },
  {
    path: 'app/api/admin/orders/route.ts',
    reason:
      'Admin route. The staff list of the orders reads the whole order.',
  },
  {
    path: 'app/api/admin/orders/[id]/route.ts',
    reason:
      'Admin route. The staff view of an order shows the cost of the lines.',
  },
  {
    path: 'app/api/admin/products/route.ts',
    reason:
      'Admin route. The staff list of the products reads the whole product.',
  },
  {
    path: 'app/api/admin/products/[id]/route.ts',
    reason:
      'Admin route. The staff view of a product reads the whole product.',
  },
  {
    path: 'app/api/admin/refund-requests/route.ts',
    reason:
      'Admin route. The staff list of the refund requests reads the whole order.',
  },
  {
    path: 'app/api/admin/vendors/[id]/route.ts',
    reason:
      'Admin route. The staff view of a vendor reads the lines of the orders of that vendor.',
  },
  {
    path: 'app/api/vendor/customers/route.ts',
    reason:
      'Vendor-only route. It reads the lines of the orders of the vendor\'s own customers.',
  },
  {
    path: 'app/api/vendor/customers/[id]/route.ts',
    reason:
      'Vendor-only route. It reads the lines of the last order of a customer of the vendor\'s own store.',
  },
  {
    path: 'app/api/vendor/fulfillment/route.ts',
    reason:
      'Vendor-only route. It reads the whole order to answer the fulfilment screen.',
  },
  {
    path: 'app/api/homepage-sections/[id]/products/route.ts',
    reason:
      'Super-admin route. The products of a homepage section are staff data.',
  },
  {
    path: 'app/api/super-admin/brands/[id]/products/route.ts',
    reason:
      'Super-admin route. The products of a brand are staff data.',
  },
  {
    path: 'app/api/super-admin/orders/[id]/route.ts',
    reason:
      'Super-admin route. The staff view of an order shows the cost of the lines.',
  },
  {
    path: 'lib/refunds/refund-service.ts',
    reason:
      'Server-side refund math. It reads the whole order and its lines to work out what may be refunded. Nothing it reads is sent to a buyer.',
  },
  {
    path: 'lib/stock-allocation-engine.ts',
    reason:
      'Server-side stock math. It reads the whole product and variant to work out the allocation. Nothing it reads is sent to a buyer.',
  },
  {
    path: 'lib/stock-reservation.ts',
    reason:
      'Server-side stock math. It reads the whole product and variant to reserve and release stock. Nothing it reads is sent to a buyer.',
  },
  {
    path: 'lib/webhooks/order-webhook-handler.ts',
    reason:
      'Server-side webhook handler. It reads the whole order and the whole product of a line to notify the vendor. Nothing it reads is sent to a buyer.',
  },
  {
    path: 'lib/ai/rule-based-engine.ts',
    reason:
      'Server-side recommendations. It reads the whole product of the vendor\'s own store and answers with a score, a name and a reason.',
  },
]

/**
 * The paths of the files that hold the schema, the migrations and the tests.
 *
 * They are outside the scanned roots, so the guard never reads them. They
 * are listed here so that the rule is written down in one place: the schema
 * is where the fields are born, and the tests are where they are named on
 * purpose.
 */
export const OUTSIDE_THE_SCANNED_ROOTS: AllowlistEntry[] = [
  {
    path: 'prisma/schema.prisma',
    reason: 'The schema is where the four fields are defined.',
  },
  {
    path: 'prisma/migrations/**',
    reason: 'The migrations that added the four fields.',
  },
  {
    path: '**/*.test.ts',
    reason:
      'A test names the fields on purpose: it asserts that they do not reach the browser.',
  },
  {
    path: '**/*.test.tsx',
    reason:
      'A test names the fields on purpose: it asserts that they do not reach the browser.',
  },
  {
    path: '**/*.test-utils.ts',
    reason:
      'A test helper names the fields on purpose: it builds the rows a test asserts on.',
  },
]
