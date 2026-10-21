-- READ ONLY: SELECT only. Run in the Railway Postgres query tab or psql.
-- No INSERT, UPDATE, DELETE, DDL, or function creation anywhere in this file.
-- Compares expected committed-blob checksums (from git blobs, LF-normalised)
-- against the production _prisma_migrations table to detect drift before deploy.

WITH expected(migration_name, expected_checksum) AS (
  VALUES
    ('20260616221808_init', 'a59cf31d36e042fc96d19750e117bf80e580738f784dc2d1aa9910be93417f41'),
    ('20260702000000_add_pending_registrations', 'b48009bf75a63a240282ac86b693862bef10bfe682f18f1f6a2f3f91ed675dc6'),
    ('20260722120000_verify_existing_users', '8bb5e26b541a0abcce395a8af645f7127a7d6d19690c76f7028cd7146f7d48cc'),
    ('20260727144800_add_services_foundation', 'bb9d248e94c9eedcf954f7aac7f50789dfc7ec71c648ba0db63d477f4b6de07f'),
    ('20260727224200_add_wishlist_service_unique', 'cbd234ef90924a62d755c7dd537ff5b81d14238d24312915f24e07e65222f15b'),
    ('20260728015006_add_missing_schema_objects', '6d33ab39c6a0449efa2b99dc5253a44a4cd4cdbea7c772b8c43c2d1a8e9178c0'),
    ('20260728023000_add_service_category_fields', '42ab576d3108632500ed1f8bb3c22af454d908c6c952f08dda731607325dccc5'),
    ('20260728154600_enable_service_offering_for_all_stores', 'e452022535eba263aa9d9b0e6c217e7276731a44f8009c2708a8965ab8e5506f'),
    ('20260729120000_add_service_request_budget_reference_and_quotation_attachments', '6a4f230b2ed059c9ddc76995c3007d382e8392fa8d420a0c4b66daad6ee74069'),
    ('20260731000000_add_service_average_rating_review_count', '30cd29455c20238cdef18bbb1154611c7eea0185d77aa981abe71338687d1f45'),
    ('20260801_loyalty_rewards_system', '251cc5c1d522e8f6c524786f3f48fde2f4318ef104408ffa1f69a1064022d0a2'),
    ('20260802_subscription_platform', '596658f616bb921df3eadd5df4433d298f824b9f216e7e381336e1324e5a0faa'),
    ('20260810000000_add_support_conversation_messaging', 'f42e1f6f1f6ca2e5bef28977042066353d65d706d284af50617c6accf7c933eb'),
    ('20260829000000_add_advertisement_model', '9103a63bf8054b6f851c9a77f4636888ac6caa2ee80b8fea7195a3c245c41b96'),
    ('20260908230000_privacy_gap_remediation', '0a4508a2d672e9f1da3f1b53eaafb8755f41bf3b8d462e28c758e2a36c8aaaed'),
    ('20260909_loyalty_referral_guards', '6fa4f94bdc300bc66e405bfac010decf82d05c94653dc6487f2e46049ecb49f4'),
    ('20260910_wallet_redemption', '3d4bee50bb2adaa5d4e4d85bc4b1d2517839f30bf30aaaf9de718a8bf4f9fe77'),
    ('20260912_product_non_returnable', '8da726197b562b8534b5caef5f8efc4abee6579319db2cad861769f123618d1b'),
    ('20260914120025_add_vendor_payout_methods', 'fa5a83d50801b3a45ac83a3a482a4f1b9188a659105ef40f58ce079bfcd81ae2'),
    ('20260916125938_add_marketing_officer_referral', '76c9a2094936e6e31bad5a1ea136b5fc31252f703289f6c0db3c1abd90061b59'),
    ('20260916133000_add_pending_registration_marketing_code', '9a24829d60b12337f81b86fa6175921881fba2eda95301b7df0cecd6a81bc57b'),
    ('20260916134000_fix_vendor_referral_fk_restrict', '11042d3b3de6bf2672f6e4c95ea357e481f6c2a1bf98ad28eb0359f90bc25bf5'),
    ('20260923233838_add_influencer_program', '002c242d64dd183404c8d5690ca621b439547fb1248b53bef384ed2f6b6b5984'),
    ('20260926010000_add_vendor_feed', '4bff63332d2215288e71d457cbe2d73a47d9ad1faf9827195fc6113abbdfbd60'),
    ('20260930120000_add_app_waitlist', 'a8a03b8d27f37d97e70434d73d3863ca7827d9704f0dd6925dd7fb6142a2c660'),
    ('20261001202400_restrict_order_items_product_fk', '1371ed73e0725cb5a53796e38e1f5e45db6ca0383cc3437ef005a97ca4434676'),
    ('20261001203000_add_influencer_account_type', '7401bf2568303aa13640837f8f0aead7a9261174d9ff3e5f61d3d0a92f71f75f'),
    ('20261008000000_add_influencer_perks', '7c0cea5ed2b3a0316d31db51ae2fd2ac020afdb32d1f4ffb0254e09016ba184a'),
    ('20261008010000_add_returns_refunds_payout_ledger', '783cae61ade955d5889faa59c056591be9f081289235270cb7c33ed39bbd5a01'),
    ('20261009000000_add_refund_links', '4fb37a5b6be92493b6cad6b8cf215cb0631db4fd539c0a2b677b8b727fe2d16d'),
    ('20261016000000_seller_os_manual_orders', 'b6852063e3c5c1b8eb88c1f9431225465ec3b6b76e26a3d3a170bae6bb692378'),
    ('20261019000000_seller_os_money_view', '6ec8e836a1226e6811496f7f2588172536ba555ad3ae11e5914ded1f536c0e3d'),
    ('20261020100000_corrective_ledger_refund_clawback_enum', '5870fa59449690b495ec4334ea20afa67d791c5221484ba040a67bb09d8a0e61'),
    ('20261020110000_corrective_ledger_refund_clawback_columns', '579ea6a9177271d2d0b2c0ef3838e5746309b4c3cbd9299cc85a5ec4e6acd15d')
),
applied AS (
  SELECT migration_name, checksum, finished_at, rolled_back_at
  FROM public._prisma_migrations
)
SELECT
  COALESCE(e.migration_name, a.migration_name) AS migration_name,
  e.expected_checksum,
  a.checksum AS recorded_checksum,
  CASE
    WHEN a.migration_name IS NULL THEN 'PENDING_NOT_APPLIED'
    WHEN e.migration_name IS NULL THEN 'APPLIED_BUT_MISSING_LOCALLY'
    WHEN a.rolled_back_at IS NOT NULL THEN 'ROLLED_BACK_OR_FAILED'
    WHEN e.expected_checksum IS DISTINCT FROM a.checksum THEN 'CHECKSUM_MISMATCH'
    ELSE 'MATCH'
  END AS status,
  a.finished_at,
  a.rolled_back_at
FROM expected e
FULL OUTER JOIN applied a ON a.migration_name = e.migration_name
ORDER BY migration_name;
