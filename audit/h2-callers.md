# H2 callers audit: JWT helper rejection handling

## Helpers and their internal safety

- `lib/auth.ts:32` `jwt.verify` — inside try/catch (`auth.ts:31-39`), returns `null`. Sync function, no rejection escapes.
- `lib/auth-edge.ts:18` `jwtVerify` — awaited inside try/catch (`auth-edge.ts:16-34`), returns `null`.
- `lib/auth-middleware.ts:30` `jwtVerify` — awaited inside try/catch (`auth-middleware.ts:28-74`), maps jose errors to failure outcomes.
- `lib/auth.ts:53` `getUserFromToken` calls the sync `verifyToken` (auth.ts version) directly — no await needed, no rejection.
- `lib/auth.ts:60` `getServerSession` calls sync `verifyToken`, then Prisma query inside try/catch (`auth.ts:63-85`).

`jsonwebtoken`/`jose` are imported only in those 3 lib files (grep confirmed). No direct `jwt.verify`/`jwtVerify`/`jwt.decode` calls elsewhere.

## Production callers — all awaited

- `middleware.ts:95` `await verifyTokenEdge(token)`
- `lib/support-ai/engine.ts:40` `await verifyToken(token)`
- `lib/returns/ui/vendor-session.ts:7` `await verifyToken(token)`
- `lib/returns/ui/server.ts:19` `await verifyToken(token)`
- `lib/returns/ui/admin-session.ts:7` `await verifyToken(token)`
- `lib/influencerAuth.ts:17` `await verifyToken(token)`
- `app/layout.tsx:51` `await getServerSession()`
- `app/dashboard/customer/wishlist/page.tsx:6` `await getServerSession()`
- `app/dashboard/influencer/page.tsx:7` `await getServerSession()`
- All `app/dashboard/vendor/*/validation.tsx` — `await verifyToken(token)` (e.g. line 16 in each)

Test files (`*.test.ts`) mock `verifyToken` — not production.

## Unhandled-rejection scan

No production call is missing `await`, inside an event handler, `setTimeout`, or a `.then` chain without `.catch`. No `.then(` in `app/` relates to JWT (all are fetch/recharts/dynamic imports). No fire-and-forget background task calls a JWT helper.

## Three most likely places an unhandled JWT rejection could still come from

1. **Direct `jwt.verify`/`jwtVerify` bypassing the helpers** — none found by static grep (only the 3 lib files import jsonwebtoken/jose), but unverified against dynamic `require`/`import()`.
2. **A helper invoked without `await`** in an event handler/route — none found; every production caller awaits.
3. **A helper promise discarded in a `.then()` chain without `.catch()`** — none found in `app/`.

Assessment: based on current code, no unhandled JWT rejection escapes the helpers. The `server-entry.js` handlers likely existed pre-hardening (same commit `f1dc658` added both the swallowing handlers and hardened `lib/auth-middleware.ts`/`lib/auth.ts`) and now mainly swallow non-JWT errors.
