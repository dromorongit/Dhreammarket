# H1 Step 1 — TypeScript & ESLint error measurement

Read-only measurement. No source or config files modified. No build command run (`tsc --noEmit` and `next lint` only).

## Method

1. `npx prisma generate` — regenerated Prisma Client types (not a build). Succeeded.
2. `npx tsc --noEmit` — TypeScript type check.
3. `npx next lint` — ESLint via Next.js.

## Totals

| Checker | Errors | Warnings | Notes |
|---|---|---|---|
| TypeScript (`tsc --noEmit`) | 0 | n/a | Exited clean; no type errors reported |
| ESLint (`next lint`) | 0 | 3 | All warnings are the same rule |

**Total TypeScript errors: 0**

**Total ESLint errors: 0 | Total ESLint warnings: 3**

## Top 10 files by error/warning count

Only 3 files contain any lint issues; each has exactly 1 warning. No file has more than 1.

| Rank | File | Issues | Type |
|---|---|---|---|
| 1 | `components/returns/admin/AdminReturnDetail.tsx` | 1 | warning |
| 2 | `components/returns/vendor/VendorReturnRespond.tsx` | 1 | warning |
| 3 | `components/returns/vendor/VendorReturnRow.tsx` | 1 | warning |

(Files 4–10: none — 0 issues each.)

## Most common error codes / rules

Only one rule is triggered, 3 times.

| Rank | Rule / code | Count | Example | Fix category |
|---|---|---|---|---|
| 1 | `@next/next/no-img-element` | 3 | `components/returns/vendor/VendorReturnRow.tsx:51:15` — "Using `` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image`..." | quick fix |
| 2 | — | 0 | — | — |
| 3 | — | 0 | — | — |
| 4 | — | 0 | — | — |
| 5 | — | 0 | — | — |

## Per-category fix assessment

| Category | Count | Assessment | Rationale |
|---|---|---|---|
| TypeScript errors | 0 | n/a | No type errors to fix |
| ESLint errors | 0 | n/a | No lint errors to fix |
| ESLint warnings — `@next/next/no-img-element` | 3 | quick fix | Mechanical: replace `` with Next `<Image />` (add `width`/`height`/`alt`) in the 3 flagged files. No logic change. |

## Summary

The codebase is clean on both measured dimensions: **0 TypeScript errors** and **0 ESLint errors**, with only 3 trivial `next/image` warnings. No remediation is blocking; the 3 warnings are quick-fix image-to-`<Image />` conversions.
