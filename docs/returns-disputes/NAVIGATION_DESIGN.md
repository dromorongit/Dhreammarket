# Returns navigation design

## Existing files to modify
1. components/Navbar.tsx (client) - keep its returnsFlowEnabled prop; the role passed to getReturnsNavItems is typed as string so SUPER_ADMIN is the only role that receives the admin returns entry (admin pages are gated by getSuperAdminSession and require SUPER_ADMIN).
2. app/layout.tsx (server) - compute isReturnsFlowEnabled() once and pass it to <Navbar returnsFlowEnabled={...} />.
3. app/dashboard/customer/orders/[id]/page.tsx (client) - no longer accepts a returnsFlowEnabled prop; read the flag with useReturnsFlowEnabled().
4. app/dashboard/customer/orders/[id]/layout.tsx (server) - compute isReturnsFlowEnabled() and render <ReturnsFlowProvider enabled={isEnabled}>{children}</ReturnsFlowProvider>, where ReturnsFlowProvider is a new client context provider under components/returns/ that exposes useReturnsFlowEnabled() (default false without a provider).
5. lib/returns/ui/navigation.ts - pure helper: getReturnsNavItems, shouldShowReturnLink, buildReturnLinkHref. The role parameter is string; the admin entry (/dashboard/admin/returns) is returned only for SUPER_ADMIN, and [] for any role without returns pages (including ADMIN).
## New files

- lib/returns/ui/navigation.ts - pure helper: getReturnsNavItems, shouldShowReturnLink, buildReturnLinkHref.
- app/dashboard/customer/orders/[id]/layout.tsx - server layout that computes the flag and provides it to the page via ReturnsFlowProvider context instead of passing a prop.
- components/returns/ReturnsFlowProvider.tsx - client context provider and useReturnsFlowEnabled hook (default false without a provider).
- components/returns/ReturnsFlowProvider.test.tsx - provider defaults and static wiring assertions.
- lib/returns/ui/navigation.test.ts - tests for every role in the Prisma Role enum, flag on and off.
- docs/returns-disputes/NAVIGATION_MANUAL_TEST.md - manual test script.

## Data flow

- Server components/layouts call isReturnsFlowEnabled() only.
- The resulting boolean is passed to client components as a prop.
- Client components never read process.env or a NEXT_PUBLIC_ variable.
- With the flag unset, helpers return no entries and no link; rendered output matches the current behaviour.

## Intentionally not done

- No notifications, unread counts, emails, or seller "needs response" badges.
- No changes to returns eligibility policy, routes, schema, or other pages.
