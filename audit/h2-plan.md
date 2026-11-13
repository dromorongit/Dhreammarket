# H2 audit plan: server-entry.js JWT error swallowing

## 1. What server-entry.js swallows

`server-entry.js:3-26` (`unhandledRejection`) and `server-entry.js:28-51` (`uncaughtException`) both match `reason.code || reason.name` against:
- `ERR_JWT_EXPIRED`, `ERR_JWT_INVALID`, `ERR_JWS_SIGNATURE_VERIFICATION_FAILED`, `JWTExpired`, `JWTInvalid`

On a match they log and `return` (process continues). Non-matches log `"Non-fatal ... process continuing"` but ALSO continue — **neither handler ever calls `process.exit(1)`**. So the handlers swallow ALL error types, not just JWT; genuine exceptions leave the process running in an unstable state.

Added in commit `f1dc658` "RAILWAY SERVICE CRASH FIXES" (2026-09-13, Narh Henry Padi Dromor). `git show f1dc658` body is empty; no linked docs. `git blame` shows all 53 lines introduced by that single commit.

## 2. JWT verify/decode inventory

Only 3 production sites (all appear caught — unverified at every call site):
- `lib/auth.ts:32` `jwt.verify` — inside try/catch (`auth.ts:37-39`), returns `null`. Callers `getUserFromToken`/`getServerSession` (`auth.ts:48-86`) await/try-catch. `jwt.sign` at `auth.ts:23` signs only.
- `lib/auth-edge.ts:18` `jwtVerify` — awaited inside try/catch (`auth-edge.ts:16-34`).
- `lib/auth-middleware.ts:30` `jwtVerify` — awaited inside try/catch (`auth-middleware.ts:28-74`), maps `JWTExpired`/`JWTInvalid`/`JWSSignatureVerificationFailed`/`JWSInvalid` to failure reasons.

Callers: `middleware.ts:95` awaits `verifyTokenEdge`; server components await `verifyToken`/`verifyTokenEdge` (e.g. `validation.tsx` files, `lib/support-ai/engine.ts:40`). Grep for `jwt.verify|jwtVerify|jwt.decode` returned no other sites. No floating `.then`/missing-await on JWT found, but not every caller individually audited (unverified).

## 3. Sentry

`Sentry.init` only in `instrumentation.ts:8` (server `register`) and `instrumentation-client.ts:4`. `server-entry.js` imports no Sentry; its handlers run at lines 3-51, **before** `require('.next/standalone/server.js')` at line 53. So Sentry is NOT initialized before these handlers run → unhandled rejections would NOT be reported by Sentry today. Unverified whether the built standalone server self-inits Sentry (requires `.next` output; no build run).

## 4. Process behavior & Railway restart

On a genuine uncaught exception the handler logs and continues (no exit). Railway restarts containers on process exit; since nothing exits, no restart is triggered. `README.md:101-108` marks the app "Railway-ready" but documents no restart policy. Swallowing hides all non-JWT errors too (Prisma/DB, network, etc.) — they log and continue.

## 5. Smallest safe fix (order + crash risk)

1. Verify every `jwt.verify`/`jwtVerify` caller is awaited + caught (read-only). Risk: none.
2. Add `Sentry.init` (or ensure it runs) before the handlers so unexpected errors are reported; then shrink both handlers: on the 5 JWT codes, increment a counter + log line and continue; on anything else, `Sentry.captureException(error)` then `process.exit(1)`. Risk: medium — previously-swallowed real errors will now crash/restart (Railway restarts on exit); do step 1 first and confirm Sentry DSN is set before enabling exit.
