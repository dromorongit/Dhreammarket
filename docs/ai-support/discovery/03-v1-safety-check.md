# Discovery Part 3 — v1 Safety Check

**Scope:** Read-only inspection of the v1 support AI path in the Dhream Market main app:
`lib/support-ai/engine.ts`, `lib/support-ai/cache.ts`, `lib/support-ai/dynamic-lookups.ts`
and `app/api/support-ai/chat/route.ts`. No files were modified.

## Question 1 — Prisma lookups of orders, payouts, vendors, users

### Orders: `lookupOrderStatus` (orders)

- `lib/support-ai/dynamic-lookups.ts:4-41`
- `prisma.order.findMany({ where: { userId }, ... })` at `dynamic-lookups.ts:17-30`
- Called from `engine.ts:97-98` only when `intent.dynamicType === 'order_status'` **and** `userId` is defined.
- `userId` comes from `verifyToken(token)` at `engine.ts:40-43`; no token / invalid token → `userId` stays `undefined` (engine.ts:36-45) and the lookup is skipped ("please log in" response, engine.ts:87-93).
- **Caller authenticated:** yes — the lookup runs only after a verified token yields a `userId`.
- **Ownership checked in code:** yes — the `where` clause filters orders by the authenticated user's own `userId` (`dynamic-lookups.ts:10`), so one user can never retrieve another user's orders.

### Vendors/stores: `getVendorStoreId`

- `lib/support-ai/engine.ts:131-138`
- `prisma.store.findUnique({ where: { userId } })` at `engine.ts:133`
- Called from `engine.ts:101` with the authenticated `userId`.
- **Caller authenticated:** yes — same gate as above.
- **Ownership checked in code:** yes — store is looked up by the caller's own `userId`.

### Payouts: `lookupVendorPayoutStatus`

- `lib/support-ai/dynamic-lookups.ts:43-100`
- `prisma.vendorPayout.findMany({ where: { vendorId } })` at `dynamic-lookups.ts:49-61`
- `prisma.vendorSubscription.findFirst({ where: { vendorId } })` at `dynamic-lookups.ts:62-75`
- `vendorId` is the store id returned by `getVendorStoreId(userId)` (engine.ts:101-110), so the vendor/payout data is reachable only through the authenticated user's own store.
- **Caller authenticated:** yes.
- **Ownership checked in code:** yes — chained through `userId → store → vendorId`.

### Users

- No Prisma lookups of the `User` model occur in the v1 chat path. `verifyToken` decodes the JWT (no DB), and `engine.ts` never queries `prisma.user`.

### Other Prisma access

- `lib/support-ai/knowledge-base.ts` is a hardcoded in-memory knowledge base — no Prisma.
- No dynamic lookup runs without authentication: `engine.ts:87-93` returns a "please log in" message before any Prisma call when `userId` is missing.

## Question 2 — In-memory cache keying

- `lib/support-ai/cache.ts:33-35`: `generateCacheKey(userRole, message)` = `${userRole}:${hashMessage(message)}`
- `lib/support-ai/cache.ts:37-46` / `48-57`: the store is a single `Map` shared by all requests (module-level singleton `supportAICache` at `cache.ts:89`, engine at `engine.ts:8`).
- **Keyed by user:** NO. The key is role + message hash; `userId` is not part of the key.
- **Can one user's data be served to another?** No per-user data is ever cached: `isCacheableIntent` (`engine.ts:14-16`) returns `false` for dynamic intents, so order/payout/store lookups bypass the cache entirely (`engine.ts:49,59-62`). Cached entries are static knowledge-base answers that are identical for every user of the same role. Two customers asking the same question receive the same generic answer — that is intended, and no private data crosses users.
- Caveat: the cache is not keyed by `userId`, so if dynamic (per-user) content were ever cached, it would leak across users. Defense-in-depth recommendation: include `userId` in the cache key or scope cached entries per user.

## Summary

| Item | Finding |
|------|---------|
| Orders lookup | Authenticated + ownership filter by `userId` (`dynamic-lookups.ts:10`) |
| Vendor/store lookup | Authenticated + ownership filter by `userId` (`engine.ts:133`) |
| Payout/subscription lookup | Authenticated + ownership chained via user's own store (`dynamic-lookups.ts:49-75`) |
| Unauthenticated callers | No Prisma lookup runs ("please log in", `engine.ts:87-93`) |
| Cache keyed by user | No (role + message hash) |
| Cache can leak per-user data | No — only static role-scoped KB answers are cached; dynamic lookups bypass cache |

**Checkpoint decision:** CONTINUE. Every Prisma lookup of orders/payouts/vendors in the v1 path is gated on a verified session and filtered by the caller's own `userId`, and the in-memory cache holds only non-personal static answers, so no lookup lacks auth/ownership and the cache cannot serve one user's data to another.
