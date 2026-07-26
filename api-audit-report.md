# DhreamMarket Frontend API Audit Report

**Date:** 2026-07-26
**Scope:** All frontend API requests triggered automatically on page load
**Methodology:** Searched all `.tsx`/`.ts` files for `fetch()`, `useSWR`, `axios`, `ky`, React Query, server actions, and route handlers
**Excluded:** `lib/email.ts` (Brevo transactional email, not frontend page-load API)

---

## Summary of Findings

- **Total unique API endpoints across codebase:** ~45+
- **Architecture:** 100% client-side `fetch()` -- no SSR data fetching, no SWR, no React Query, no server actions
- **Critical pattern:** Every page independently fetches its own data with `useEffect` + `fetch()`, leading to massive duplication, sequential waterfalls, and lost caching opportunities
- **Shared state via Context only for Cart** (`CartContext.tsx`) -- all other domain data is fetched independently per component
- **Navbar fetches 3 endpoints on every page** (`/api/auth/me`, `/api/notifications`, `/api/wishlist`) that are also refetched by page-level components where applicable

---

## Page-by-Page Reports

---

### 1. HOMEPAGE (`app/page.tsx`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/vendors/featured` | `Home` (FeaturedVendorsSection) | `useEffect([], [])` | 1 |
| 2 | `GET /api/homepage/enterprise` | `useEnterpriseHomepageData()` | `useEffect([], [])` | 1 |
| 3 | `GET /api/homepage/public` | `useManagedHomepageData()` | `useEffect([], [])` | 1 |
| 4 | `GET /api/vendor-categories` | `VendorCategorySection` | `useEffect([], [])` | 1 |
| 5 | `GET /api/vendors` | `VendorCategorySection` | `useEffect([], [])` | 1 |
| 6 | `GET /api/vendors?limit=4&sortBy=rating` | `TopVendorsSection` | `useEffect([], [])` | 1 |
| 7 | `GET /api/vendors?limit=4` | `NewVendorsSection` | `useEffect([], [])` | 1 |
| 8 | `GET /api/categories` | `PopularCategoriesSection` | `useEffect([], [])` | 1 |
| 9 | `GET /api/products` | `FeaturedProductsSection` | `useEffect([excludeKey], [])` | 1 |
| 10 | `POST /api/cart` | `FeaturedProductsSection` (addToCart) | User interaction | 1 |

**Total requests on initial load:** 9 GET endpoints (10th is action-only)

#### Issues Found

- **DUPLICATE: `/api/vendors` called 3 separate times** with different parameters on the same page:
  - `/api/vendors/featured` (line 100)
  - `/api/vendors` (line 576, `VendorCategorySection`)
  - `/api/vendors?limit=4&sortBy=rating` (line 720, `TopVendorsSection`)
  - `/api/vendors?limit=4` (line 814, `NewVendorsSection`)
  These could potentially be consolidated into a single `/api/vendors` call with query params.

- **DUPLICATE: `/api/categories` called 2 times** (line 908 by `PopularCategoriesSection` and elsewhere)

- **DUPLICATE: `/api/vendor-categories` called by both `VendorCategorySection` and `useManagedHomepageData`** (indirectly via `/api/homepage/public` which may include it)

- **Sequential dependency:** `FeaturedProductsSection` depends on `excludeFromFeaturedIds` which depends on `enterpriseSections` and `sectionsBySlug` from managed data -- products fetch waits for section data to compute exclusion list

- **BLOCKING RENDER:** 4 independent `useEffect` fetches in the home page all run after first render, causing layout shifts with skeleton loaders. The `VendorCategorySection`, `TopVendorsSection`, `NewVendorsSection`, and `PopularCategoriesSection` all have their own loading skeletons.

- **Navbar duplication:** The navbar (`/api/auth/me`, `/api/notifications`, `/api/wishlist`) also fetches these independently on every page including the homepage.

- **Cache opportunity:** `/api/vendors/featured`, `/api/categories`, `/api/vendor-categories` are static/semi-static data that could be cached or served via SSR

- **CartContext cart fetch:** Cart is fetched via `CartProvider` on every page load (`/api/cart`), even on the homepage where no cart UI is rendered

---

### 2. MARKETPLACE (`app/marketplace/marketplace-client.tsx` + `app/marketplace/page.tsx`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/products?page=1&limit=50` | `fetchProducts()` | `useEffect([], [])` (products tab) | 1 |
| 2 | `GET /api/categories` | `fetchCategories()` | `useEffect([], [])` | 1 |
| 3 | `GET /api/vendor-categories` | `fetchVendorCategories()` | `useEffect([], [])` | 1 |
| 4 | `GET /api/products/count` | `fetchCounts()` | `useEffect([], [])` | 1 |
| 5 | `GET /api/products?limit=1` | `fetchCounts()` fallback | `useEffect([], [])` (if count fails) | 1 |
| 6 | `GET /api/categories` | `fetchCounts()` | `useEffect([], [])` | 1 (duplicate of #2) |
| 7 | `GET /api/vendors?limit=1` | `fetchCounts()` | `useEffect([], [])` | 1 |
| 8 | `GET /api/vendor-categories` | `fetchCounts()` | `useEffect([], [])` | 1 (duplicate of #3) |
| 9 | `GET /api/vendors?page=1&limit=20` | `fetchVendors()` | `useEffect([], [])` (vendors tab) | 1 |
| 10 | `GET /api/wishlist/check?productIds=...` | `fetchWishlistStatus()` | `useEffect([], [])` + on page change | 1 |
| 11 | `GET /api/cart` | Cart context | CartProvider | 1 |

**Total requests on initial load:** 11 GET endpoints (including duplicates)

#### Issues Found

- **DUPLICATE: `/api/categories` called twice** -- once by `fetchCategories()` (line 166) and once by `fetchCounts()` (line 223). Same for `/api/vendor-categories` (lines 178 and 240).

- **DUPLICATE: `/api/wishlist/check` called on mount AND on every product pagination change** (lines 123-126, 255). The `fetchWishlistStatus` is triggered inside `useEffect` that depends on `productPagination.page`, meaning it fires again after every page navigation.

- **SERIAL SEQUENTIAL:** `fetchCounts()` fetches `/api/products/count`, then conditionally `/api/products?limit=1`, then `/api/categories`, then `/api/vendors?limit=1`, then `/api/vendor-categories` -- all sequentially in one `async` function. These are independent and should be parallelized with `Promise.all`.

- **SERIAL SEQUENTIAL:** The initial `useEffect` (lines 115-121) calls `fetchCategories()`, `fetchVendorCategories()`, `fetchCounts()`, `fetchVendors()`, and `fetchWishlistStatus()` -- these are all sequential within their individual functions, and `fetchCounts()` itself is serial.

- **BLOCKING RENDER:** `loading` state is shared for all these fetches; a single failure in `fetchCounts()` leaves the whole marketplace in loading state.

- **Cache opportunity:** `/api/categories`, `/api/vendor-categories`, and `/api/products/count` rarely change and should be cacheable.

- **Navbar duplication:** Navbar also fetches `/api/wishlist`, `/api/auth/me`, and `/api/notifications`.

- **Products and vendors fetches are conditionally skipped** based on `viewMode` but pagination state still triggers re-fetches for both modes.

---

### 3. CART (`app/cart/page.tsx` + `lib/CartContext.tsx`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/cart` | CartProvider `fetchCart()` | `useEffect([], [])` | 1 |
| 2 | `PATCH /api/cart/items/{id}` | `cartUpdateQuantity()` | User interaction (quantity buttons) | 0 (on load) |
| 3 | `DELETE /api/cart/items/{id}` | `cartRemoveItem()` | User interaction (remove button) | 0 (on load) |
| 4 | `POST /api/cart` | `addToCart()` | User interaction (add to cart) | 0 (on load) |

**Total requests on initial load:** 1

#### Issues Found

- **CART CONTEXT OVER-FETCHING:** `CartProvider` fetches `/api/cart` on every single page load (line 225-239), including pages where no cart UI is visible (homepage, product detail, checkout). The cart is only meaningfully needed on the `/cart` and `/checkout` pages.

- **CASCADING RE-FETCHES:** After every cart mutation (`addToCart`, `updateQuantity`, `removeItem`), the code calls both `setCart(data.cart)` directly AND `fetchCart()` to refetch the full cart from the server. This means mutations trigger an extra `GET /api/cart` call that could be avoided by updating the local state directly from the mutation response.

- **Duplicate cart fetch from page:** `cart/page.tsx` uses `useCart()` which provides the cart data from context, but the `CartProvider` already fetches it. No additional direct fetch is needed from the cart page itself -- this is fine.

- **Cache opportunity:** The cart is user-specific and changes frequently, so `cache: 'no-store'` is appropriate, but the re-fetch after every mutation is wasteful.

- **`fetchCart` deduplication works:** `CartContext.tsx` line 90-91 uses `fetchCartPromiseRef` to deduplicate concurrent calls -- this is a good pattern applied correctly.

---

### 4. CHECKOUT (`app/checkout/CheckoutContent.tsx`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/auth/me` | `fetchProfile()` | `useEffect([], [])` | 1 |
| 2 | `GET /api/checkout` (POST for initialization) | `handleCheckout()` | User interaction | 0 (on load) |
| 3 | `POST /api/payment/verify` | `verifyPayment()` | User interaction (after redirect back) | 0 (on load) |

**Total requests on initial load:** 1 GET

#### Issues Found

- **REDUNDANT AUTH CHECK:** `CheckoutContent.tsx` fetches `/api/auth/me` (line 314) to populate the checkout form with user profile data. However, the Navbar already fetched `/api/auth/me` on this same page load. The same user profile data is fetched twice.

- **Sequential dependency:** Profile fetch (line 314) happens first, then checkout initialization (line 383) happens only on user submit. These are not blocking each other, which is correct for the checkout flow.

- **CartContext also fetches `/api/cart`** on load (from CartProvider), which is also fetched by the cart page and marketplace. The checkout page needs the cart but doesn't fetch it directly -- it relies on context. The CartProvider fetch is the one that matters.

- **Cache opportunity:** `/api/auth/me` could be cached for the duration of the session since user profile doesn't change mid-session.

---

### 5. CUSTOMER DASHBOARD (`app/dashboard/customer/page.client.tsx` + `app/dashboard/customer/orders/`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/orders` | `fetchOrders()` | `useEffect([], [])` | 1 |
| 2 | `GET /api/auth/me` | Navbar | Layout | 1 |
| 3 | `GET /api/notifications` | Navbar | Layout | 1 |
| 4 | `GET /api/wishlist` | Navbar | Layout | 1 |

**Total requests on initial load:** 4 GET endpoints (1 direct + 3 from layout)

#### Issues Found

- **MINIMAL PAGE-LEVEL FETCH:** The customer dashboard only fetches `/api/orders`, which is appropriate. The rest come from the shared Navbar layout.

- **NAVBAR OVER-FETCHING:** Navbar fetches `/api/auth/me`, `/api/notifications`, and `/api/wishlist` on the dashboard even though the dashboard doesn't use wishlist or notification UI elements. The cart quantity from CartContext is used though.

- **No duplicate within page-level fetches** -- this is one of the cleaner pages.

- **Cache opportunity:** `/api/orders` could benefit from stale-while-revalidate caching since order data doesn't change frequently for a given user.

---

### 6. VENDOR DASHBOARD (`app/dashboard/vendor/page.client.tsx`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/vendor/orders` | `fetchVendorOrders()` | `useEffect([], [])` | 1 |
| 2 | `GET /api/vendor/metrics` | `fetchMetrics()` | `useEffect([], [])` | 1 |
| 3 | `GET /api/vendor/restock-orders` | `fetchRestockOrders()` | `useEffect([], [])` | 1 |
| 4 | `GET /api/verification-payment` | `handleApplyForVerification()` | User interaction only | 0 (on load) |
| 5 | `PATCH /api/vendor/orders/{orderId}` | `updateOrderStatus()` | User interaction only | 0 (on load) |
| 6 | `POST /api/vendor/restock-orders` | `createRestockOrderHandler()` | User interaction only | 0 (on load) |
| 7 | `GET /api/auth/me` | Navbar | Layout | 1 |
| 8 | `GET /api/notifications` | Navbar | Layout | 1 |
| 9 | `GET /api/wishlist` | Navbar | Layout | 1 |

**Total requests on initial load:** 3 direct + 3 from layout = 6

#### Issues Found

- **Sequential waterfall in `updateOrderStatus()`** (line 237-263): After PATCHing order status, it calls `await fetchVendorOrders()` then `await fetchMetrics()` sequentially. These two fetches are independent and should be parallelized with `Promise.all`.

- **All 3 initial fetches run sequentially** within `useEffect([], [])` because `fetchVendorOrders()`, `fetchMetrics()`, and `fetchRestockOrders()` are called one after another (lines 117-119), not in parallel.

- **`/api/vendor/restock-orders` is fetched on load** even though it's rarely needed for the initial view -- it could be lazy-loaded.

- **Navbar duplication:** Same 3 navbar fetches on every page.

---

### 7. ADMIN DASHBOARD (`app/dashboard/admin/page.client.tsx`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/admin/stats` | `fetchStats()` | `useEffect([], [])` | 1 |
| 2 | `GET /api/auth/me` | Navbar | Layout | 1 |
| 3 | `GET /api/notifications` | Navbar | Layout | 1 |
| 4 | `GET /api/wishlist` | Navbar | Layout | 1 |

**Total requests on initial load:** 4 GET endpoints

#### Issues Found

- **SINGLE FETCH PAGE:** The admin dashboard only fetches `/api/admin/stats` which is relatively clean.

- **The stats endpoint bundles many data types** (users, vendors, products, orders, reviews, categories, demand analytics, preorder/backorder analytics, etc.) -- this is good for batching but may over-fetch if only partial data is needed for the initial view.

- **No duplicate requests within the page-level fetches.**

---

### 8. SUPER ADMIN DASHBOARD (`app/dashboard/super-admin/page.client.tsx`)

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/admin/stats` | `fetchData()` | `useEffect([], [])` | 1 |
| 2 | `GET /api/admin/users?role=ADMIN` | `fetchData()` | `useEffect([], [])` | 1 |
| 3 | `GET /api/admin/vendors` | `fetchData()` | `useEffect([], [])` | 1 |
| 4 | `GET /api/admin/support` | `fetchData()` | `useEffect([], [])` | 1 |
| 5 | `GET /api/auth/me` | Navbar | Layout | 1 |
| 6 | `GET /api/notifications` | Navbar | Layout | 1 |
| 7 | `GET /api/wishlist` | Navbar | Layout | 1 |

**Total requests on initial load:** 4 direct + 3 from layout = 7

#### Issues Found

- **PARALLEL FETCH DONE RIGHT:** This is the best initial load pattern in the codebase (line 80-85). All 4 fetches run in parallel via `Promise.all` and 3 different `fetch()` calls are made concurrently in a single `useEffect`.

- **However, `fetchData()` is NOT cached** and will re-run on every page navigation/refresh since it's inside a `useEffect` with no dependency array optimization.

- **NO duplicate requests within the page-level fetches** -- this is clean.

- **Navbar duplication:** Same 3 navbar fetches on every page.

---

### 9. VENDOR PRODUCT EDIT/NEW (`app/dashboard/vendor/products/[id]/edit/page.tsx` and `new/page.tsx`)

#### API Requests on Initial Load (New Product Page)

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/store` | `useEffect([], [])` | 1 |
| 2 | `GET /api/categories` | `useEffect([], [])` | 1 |
| 3 | `GET /api/brands` | `useEffect([], [])` | 1 |
| 4 | `POST /api/products` | Submit handler | 0 (on load) |

#### API Requests on Initial Load (Edit Product Page)

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/store` | `useEffect([], [])` | 1 |
| 2 | `GET /api/categories` | `useEffect([], [])` | 1 |
| 3 | `GET /api/brands` | `useEffect([], [])` | 1 |
| 4 | `GET /api/products/{productId}` | `fetchProduct()` | `useEffect([], [])` | 1 |
| 5 | `PATCH /api/products/{productId}` | Save handler | User interaction | 0 (on load) |

**Total requests on initial load (New):** 3
**Total requests on initial load (Edit):** 4

#### Issues Found

- **TRIPLE FETCH OF STATIC DATA:** Both New and Edit product pages independently fetch `/api/store`, `/api/categories`, and `/api/brands` -- all of which are static reference data that rarely change. These could be shared via a global cache or fetched once at layout level.

- **Edit page fetches product data separately** from the static reference data, creating a 2-phase load.

- **No deduplication** between New and Edit paths.

---

### 10. VENDOR SETTINGS / PROFILE

#### API Requests on Initial Load

| # | Endpoint | Component | Trigger | Count |
|---|----------|-----------|---------|-------|
| 1 | `GET /api/settings/vendor` | `SettingsContext` | `useEffect([], [])` | 1 |
| 2 | `GET /api/profile` | `PreferencesSection` | User action | 0 (on load) |
| 3 | `GET /api/settings/super-admin` | `SuperAdminSections` | User action | 0 (on load) |

**Total requests on initial load:** 1 (from SettingsContext)

#### Issues Found

- **SettingsContext fetches once but PreferencesSection and SuperAdminSections refetch on user interaction** -- not duplicated on load, but the pattern of refetching from settings context data would avoid extra calls.

---

## Cross-Cutting Issues (Across All Pages)

### 1. NAVBAR SHARED LAYOUT FETCHES

The Navbar component (`components/Navbar.tsx`) fetches **3 endpoints on every single page load:**

| Endpoint | Trigger | Purpose |
|----------|---------|---------|
| `GET /api/auth/me` | `useEffect([], [])` | User profile for navbar display |
| `GET /api/notifications` | `useEffect([user], [])` | notification count and list |
| `GET /api/wishlist` | `useEffect([user], [])` + event listener | wishlist count |

**Impact:** These 3 requests fire on every page navigation, even if the page itself doesn't need this data. Combined with page-level fetches, this means many pages make redundant requests for the same data.

**Opportunities:**
- Move these to a global auth/session loader (e.g., Next.js `layout.tsx` or a context provider at the root level)
- Cache `/api/auth/me` results for the session
- Use `stale-while-revalidate` for notification/wishlist counts
- The navbar also triggers a `POST /api/auth/logout` on logout (not a load-time issue)

### 2. CART CONTEXT GLOBAL FETCH

`CartProvider` fetches `/api/cart` on every page load (line 225 of `CartContext.tsx`). This means **every page** makes a cart fetch even if no cart UI is present.

**Impact:** Minimum of 1 extra `GET /api/cart` per page load for all users, including unauthenticated users who may not have a cart.

**Opportunities:**
- Only fetch cart when the user is authenticated
- Use session-based cart loading
- Lazy-load cart data only when cart-related components are mounted

### 3. MISSING CACHING STRATEGY

**No `cache` option is used on any `fetch()` call except:**
- `/api/homepage/enterprise` uses `cache: 'no-store'` (explicitly)
- `/api/homepage/public` uses `cache: 'no-store'` (explicitly)

All other fetches use the default browser cache, which is unreliable for API responses. There is no SWR, React Query, or any cache layer whatsoever.

**Opportunities:**
- Implement SWR or React Query for automatic caching, deduplication, revalidation, and focus refetching
- Add `cache: 'force-cache'` or `next.revalidate()` for static data (`/api/categories`, `/api/vendor-categories`, `/api/vendors/featured`)
- This would eliminate duplicate fetches across components automatically

### 4. PARALLELIZATION OPPORTUNITIES

Pages that fetch dependent data sequentially when they could be parallel:

| Page | Sequential Pattern | Should Be Parallel |
|------|--------------------|--------------------|
| Homepage | `VendorCategorySection` + `TopVendorsSection` + `NewVendorsSection` + `PopularCategoriesSection` each have their own `useEffect` | All 4 should be merged into one `Promise.all` or consolidated |
| Marketplace | `fetchCounts()` runs 5 fetches sequentially inside one function | Use `Promise.all` inside `fetchCounts()` |
| Marketplace | `fetchProducts()` + `fetchWishlistStatus()` are independent but triggered by a single `useEffect` | Run in parallel |
| Vendor Dashboard | `fetchVendorOrders()` + `fetchMetrics()` + `fetchRestockOrders()` are sequential in `useEffect` | Use `Promise.all` |
| Vendor Dashboard | `fetchVendorOrders()` + `fetchMetrics()` after order status update | Use `Promise.all` |

### 5. DUPLICATE DATA FETCHED BY MULTIPLE COMPONENTS

| Data | Fetched By | Endpoint | Times |
|------|-----------|----------|-------|
| Categories | Marketplace, Homepage (PopularCategoriesSection), Vendor product edit/new | `/api/categories` | 4+ times |
| Vendor categories | Marketplace, Homepage | `/api/vendor-categories` | 3+ times |
| Vendors | Marketplace, Homepage (4 sections) | `/api/vendors` variants | 4+ times |
| Auth user | Navbar, Checkout, Vendor product edit | `/api/auth/me` | 3+ times |
| Wishlist count | Navbar, Marketplace, Product detail, Wishlist page | `/api/wishlist` + `/api/wishlist/check` | 4+ times |
| Cart | CartProvider (every page), CartPage, CheckoutContent, WishlistPage, ProductPage | `/api/cart` | 4+ times |
| Notifications | Navbar (every page) | `/api/notifications` | 1+ per page |

### 6. NO SSR / SERVER COMPONENTS USED FOR DATA

All 260+ fetch calls are in client components (`'use client'`). No Next.js Server Components fetch data on the server side. This means:
- Every page has a waterfalls of client-side fetches delaying Time to Interactive
- No data is available in the initial HTML response
- SEO is degraded for the homepage and marketplace
- Duplicate requests cannot be deduplicated by the server

**Opportunities:**
- Convert `app/page.tsx` (homepage) to a Server Component that fetches `/api/homepage/public` and `/api/homepage/enterprise` server-side
- Convert marketplace listing to a Server Component with `generateStaticParams`
- Use Server Components for static data (categories, vendor categories, vendors list)

### 7. USEEFFECT OVER-FETCHING

Multiple components fetch their data in `useEffect` with empty dependency arrays `[]`, meaning they fetch on every mount:

| Component | Fetch | Re-fetches on |
|-----------|-------|---------------|
| Homepage sections | Yes | mount |
| Marketplace | Yes | mount + category/page changes |
| CartProvider | Yes | mount + storage event |
| Navbar | Yes | mount + user change |
| All dashboards | Yes | mount |

No component uses focus-based refetching (e.g., refetch when window regains focus), which means stale data can persist after returning from a sub-page.

---

## API ENDPOINT ROUTE HANDLERS FOUND

The server-side route handlers in `app/api/` that serve the frontend include:

- **Auth:** `/api/auth/me`, `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/validate-session`, `/api/auth/update-activity`
- **Cart:** `/api/cart`, `/api/cart/items`, `/api/cart/items/[id]`
- **Products:** `/api/products`, `/api/products/[id]`, `/api/products/[id]/reviews`, `/api/products/count`
- **Vendors:** `/api/vendors`, `/api/vendors/[id]`, `/api/vendors/featured`, `/api/vendors/[id]/reviews`
- **Categories:** `/api/categories`, `/api/vendor-categories`
- **Homepage:** `/api/homepage/enterprise`, `/api/homepage/public`, `/api/homepage-sections`, `/api/homepage-sections/[id]`
- **Wishlist:** `/api/wishlist`, `/api/wishlist/[productId]`, `/api/wishlist/check`
- **Orders:** `/api/orders`, `/api/orders/[orderId]`, `/api/orders/[orderId]/cancel`, `/api/orders/[orderId]/events`, `/api/orders/[orderId]/messages`
- **Checkout:** `/api/checkout`
- **Payment:** `/api/payment/verify`, `/api/payment/webhook`
- **Auth/Profile:** `/api/profile`
- **Notifications:** `/api/notifications`
- **Reviews:** `/api/reviews`, `/api/products/[id]/reviews`
- **Search:** `/api/search`
- **Admin:** `/api/admin/stats`, `/api/admin/products`, `/api/admin/vendors`, `/api/admin/users`, `/api/admin/orders`, `/api/admin/categories`, `/api/admin/support`, `/api/admin/audit-logs`, `/api/admin/payments`, `/api/admin/analytics`, `/api/admin/cleanup-pending`
- **Vendor:** `/api/vendor/orders`, `/api/vendor/metrics`, `/api/vendor/earnings`, `/api/vendor/fulfillment`, `/api/vendor/restock-orders`, `/api/vendor/payouts`, `/api/vendor/procurement`, `/api/vendor/verification`, `/api/vendor/purchase-orders`
- **Super Admin:** `/api/super-admin/brands`, `/api/super-admin/categories`, `/api/super-admin/orders`, `/api/super-admin/reviews`, `/api/super-admin/upload`, `/api/super-admin/vendor-categories`, `/api/super-admin/verification-settings`
- **Settings:** `/api/settings/vendor`, `/api/settings/addresses`, `/api/settings/payment-methods`, `/api/settings/super-admin`, `/api/settings/admin`, `/api/settings/wishlist-preferences`
- **Support:** `/api/support`, `/api/support-tickets`, `/api/feedback`
- **Trending Products:** `/api/trending-products`
- **Verification Payment:** `/api/verification-payment`, `/api/verification-payment/webhook`
- **Upload:** `/api/upload`
- **Brands:** `/api/brands`
- **Store:** `/api/store`
- **Shipping:** `/api/shipping`
- **Notification Preferences:** `/api/notifications` (settings)

---

## Priority Recommendations

### High Priority
1. **Implement SWR or React Query** -- This alone would eliminate duplicate requests, enable caching, provide focus refetching, and deduplicate concurrent fetches. The codebase has 0 caching infrastructure.
2. **Move Navbar auth/data fetches to a root-level loader** -- `/api/auth/me`, `/api/notifications`, `/api/wishlist` are fetched by Navbar on every page and refetched by page components.
3. **Parallelize sequential fetches** in `fetchCounts()` (marketplace), vendor dashboard order-status update, and homepage section components.
4. **Consolidate `/api/categories` and `/api/vendor-categories`** -- fetched 4+ times independently across the app.

### Medium Priority
5. **Convert homepage to Server Components** for SSR data fetching (`/api/homepage/public`, `/api/homepage/enterprise`)
6. **Remove redundant `fetchCart()` re-fetch after mutations** in CartContext -- update local state directly from mutation response
7. **Add `cache: 'force-cache'` or revalidation** for static reference data (categories, vendor-categories, featured vendors)
8. **Cart should not fetch on unauthenticated page loads** -- guard the `fetchCart()` call in CartProvider

### Low Priority
9. **Move reference data (`/api/store`, `/api/categories`, `/api/brands`) to a shared layout or server loader** for vendor product pages
10. **Implement request deduplication** for `fetch()` by URL using a request-cache Map
11. **Add `stale-while-revalidate`** for dashboard stats endpoints
12. **Lazy-load restock-orders** and verification-payment data in the vendor dashboard

---

*End of report. No code changes were made.*