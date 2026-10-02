import "dotenv/config";
import { getPrisma } from "../lib/prisma";
import fs from "node:fs";
import path from "node:path";

const prisma = getPrisma();
const OUTPUT_DIR = path.join(process.cwd(), "backups");

// Models that were successfully exported by the backup script
const EXPORTED_MODELS = [
  "User", "PendingRegistration", "AuthToken", "Profile", "Store", "VendorCategory",
  "ProductCategory", "Brand", "Product", "Service", "ServiceCategory", "ServiceImage",
  "ProductVariant", "ProductImage", "ProductCategoryAssignment", "Cart", "CartItem",
  "Wishlist", "WishlistItem", "Order", "OrderItem", "Payment", "ProductReview",
  "VendorReview", "Notification", "Feedback", "VendorPayout", "VendorPayoutMethod",
  "VerificationSetting", "VendorVerificationApplication", "VendorVerificationKYC",
  "VerificationDocument", "VerificationPayment", "VerificationAuditLog", "Address",
  "PaymentMethod", "VendorSettings", "AdminSettings", "SuperAdminSettings",
  "SupportTicket", "SupportConversation", "SupportMessage", "HomepageSection",
  "HomepageSectionProduct", "HomepageSectionVendor", "HomepageSectionBrand", "AuditLog",
  "RestockOrder", "Supplier", "SupplierDocument", "PurchaseOrder", "PurchaseOrderItem",
  "FulfillmentEvent", "OrderMessage", "Session", "ServiceRequest", "ServiceRequestAttachment",
  "ServiceRequestStatusHistory", "ServiceQuotation", "QuotationAttachment", "ReviewImage",
  "ReviewVideo", "ReviewLike", "ReviewReport", "VendorReply", "ServiceReview",
  "ServiceReviewLike", "VendorReviewReply", "VendorPost", "VendorPostLike",
  "VendorPostComment", "VendorPostReport", "Collection", "CollectionItem", "RecentlyViewed",
  "SearchHistory", "Recommendation", "ProductCompare", "VendorFollow", "Coupon",
  "CouponUsage", "FlashDeal", "FlashDealProduct", "RecentlySold", "SavedSearch",
  "VendorAnalytics", "MarketplaceKPI", "SearchSuggestion", "SeoMetadata", "VendorTrustBadge",
  "NotificationPreference", "FailedEmail", "ExitIntent", "StickyButton", "RewardPoints",
  "CashbackBalance", "RewardTransaction", "CashbackTransaction", "LoyaltyTier",
  "CustomerLoyalty", "Achievement", "CustomerAchievement", "ReferralRecord",
  "RewardRedemption", "VendorRewardCampaign", "LoyaltyConfig", "SubscriptionPlan",
  "VendorSubscription", "SubscriptionInvoice", "SubscriptionPayment", "SubscriptionUsage",
  "SubscriptionFeature", "SubscriptionHistory", "AdvertisementCampaign",
  "AdvertisementPlacement", "AdvertisementPayment", "AdvertisementInvoice",
  "AdvertisementAnalytics", "AdvertisementHistory", "Advertisement", "MarketingOfficer",
  "VendorReferral", "InfluencerReferral", "InfluencerClick", "AppWaitlistEntry",
] as const;

async function main() {
  // Load backup summary
  const summaryPath = path.join(OUTPUT_DIR, "backup-summary.json");
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));

  const liveCounts: Record<string, number> = {};
  const comparison: Record<string, { backup: number; live: number; match: boolean }> = {};

  // Count exported models via Prisma
  for (const model of EXPORTED_MODELS) {
    const count = await (prisma as unknown as Record<string, unknown>)[model].count();
    liveCounts[model] = count;
    const backupCount = summary.results[model]?.count ?? 0;
    comparison[model] = {
      backup: backupCount,
      live: count,
      match: backupCount === count,
    };
  }

  // influencers table: needs raw SQL because Prisma model references missing column
  const influencerRaw = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint as count FROM "public"."influencers"
  `;
  const influencerCount = Number(influencerRaw[0]?.count ?? 0);
  liveCounts["Influencer"] = influencerCount;
  comparison["Influencer"] = {
    backup: 0,
    live: influencerCount,
    match: false,
  };

  // Save influencers via raw SQL as fallback backup
  const influencers = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM "public"."influencers"
  `;
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "influencers-raw.json"),
    JSON.stringify(influencers, null, 2)
  );
  console.log(`Saved influencers-raw.json: ${influencers.length} rows`);

  // Save row counts
  const rowCountsPath = path.join(OUTPUT_DIR, "row-counts-before.json");
  fs.writeFileSync(rowCountsPath, JSON.stringify({ exportedAt: new Date().toISOString(), counts: liveCounts }, null, 2));

  // Print comparison table
  console.log("\nTable Count Comparison:");
  console.log("Model".padEnd(35), "Backup".padStart(10), "Live".padStart(10), "Match".padStart(8));
  console.log("-".repeat(70));
  let allMatch = true;
  for (const [model, data] of Object.entries(comparison)) {
    const matchStr = data.match ? "YES" : "NO";
    if (!data.match) allMatch = false;
    console.log(model.padEnd(35), String(data.backup).padStart(10), String(data.live).padStart(10), matchStr.padStart(8));
  }

  if (!allMatch) {
    console.log("\nWARNING: Some counts do not match!");
  } else {
    console.log("\nAll exported model counts match live database.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
