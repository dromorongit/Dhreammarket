# Returns navigation manual test

## Flag off

1. Leave `RETURNS_FLOW_ENABLED` unset.
2. Customer menu: no "My returns" entry.
3. Seller menu: no "Returns" entry.
4. Admin menu: no "Returns" entry.
5. Customer order detail: no "Return this item" link on any item.
6. `/dashboard/customer/returns`, `/dashboard/vendor/returns`, `/dashboard/admin/returns`, and `/dashboard/customer/returns/new` return 404.
7. Confirm no extra network requests or database queries.

## Flag on

1. Set `RETURNS_FLOW_ENABLED=true`.
2. Customer menu shows "My returns" linking to `/dashboard/customer/returns`.
3. Seller menu shows "Returns" linking to `/dashboard/vendor/returns`.
4. Admin menu shows "Returns" linking to `/dashboard/admin/returns`.
5. Customer order detail shows "Return this item" only on paid, delivered or completed items.
6. No link on pending, shipped, cancelled, or unpaid orders.
7. Links use encoded item ids.
8. Check mobile layout at 360px and keyboard focus.
