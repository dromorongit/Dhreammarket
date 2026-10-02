import "dotenv/config";
import { getPrisma } from "../lib/prisma";
import fs from "node:fs";
import path from "node:path";

const prisma = getPrisma();

const MODELS = [
  "User",
  "PendingRegistration",
  "AuthToken",
  "Profile",
  "Store",
  "VendorCategory",
  "ProductCategory",
  "Brand",
  "Product",
  "Service",
  "ServiceCategory",
  "ServiceImage",
  "ProductVariant",
  "ProductImage",
  "ProductCategoryAssignment",
  "Cart",
  "CartItem",
  "Wishlist",
  "WishlistItem",
  "Order",
  "OrderItem",
  "Payment",
  "ProductReview",
  "VendorReview",
  "Notification",
  "Feedback",
  "VendorPayout",
  "VendorPayoutMethod",
  "VerificationSetting",
  "VendorVerificationApplication",
  "VendorVerificationKYC",
  "VerificationDocument",
  "VerificationPayment",
  "VerificationAuditLog",
  "Address",
  "PaymentMethod",
  "VendorSettings",
  "AdminSettings",
  "SuperAdminSettings",
  "SupportTicket",
  "SupportConversation",
  "SupportMessage",
  "HomepageSection",
  "HomepageSectionProduct",
  "HomepageSectionVendor",
  "HomepageSectionBrand",
  "AuditLog",
  "RestockOrder",
  "Supplier",
  "SupplierDocument",
  "PurchaseOrder",
  "PurchaseOrderItem",
  "FulfillmentEvent",
  "OrderMessage",
  "Session",
  "ServiceRequest",
  "ServiceRequestAttachment",
  "ServiceRequestStatusHistory",
  "ServiceQuotation",
  "QuotationAttachment",
  "ReviewImage",
  "ReviewVideo",
  "ReviewLike",
  "ReviewReport",
  "VendorReply",
  "ServiceReview",
  "ServiceReviewLike",
  "VendorReviewReply",
  "VendorPost",
  "VendorPostLike",
  "VendorPostComment",
  "VendorPostReport",
  "Collection",
  "CollectionItem",
  "RecentlyViewed",
  "SearchHistory",
  "Recommendation",
  "ProductCompare",
  "VendorFollow",
  "Coupon",
  "CouponUsage",
  "FlashDeal",
  "FlashDealProduct",
  "RecentlySold",
  "SavedSearch",
  "VendorAnalytics",
  "MarketplaceKPI",
  "SearchSuggestion",
  "SeoMetadata",
  "VendorTrustBadge",
  "NotificationPreference",
  "FailedEmail",
  "ExitIntent",
  "StickyButton",
  "RewardPoints",
  "CashbackBalance",
  "RewardTransaction",
  "CashbackTransaction",
  "LoyaltyTier",
  "CustomerLoyalty",
  "Achievement",
  "CustomerAchievement",
  "ReferralRecord",
  "RewardRedemption",
  "VendorRewardCampaign",
  "LoyaltyConfig",
  "SubscriptionPlan",
  "VendorSubscription",
  "SubscriptionInvoice",
  "SubscriptionPayment",
  "SubscriptionUsage",
  "SubscriptionFeature",
  "SubscriptionHistory",
  "AdvertisementCampaign",
  "AdvertisementPlacement",
  "AdvertisementPayment",
  "AdvertisementInvoice",
  "AdvertisementAnalytics",
  "AdvertisementHistory",
  "Advertisement",
  "MarketingOfficer",
  "VendorReferral",
  "Influencer",
  "InfluencerReferral",
  "InfluencerClick",
  "AppWaitlistEntry",
] as const;

type ModelName = (typeof MODELS)[number];

const BATCH_SIZE = 1000;
const OUTPUT_DIR = path.join(process.cwd(), "backups");

async function exportModel(modelName: ModelName) {
  const fileName = `${modelName.toLowerCase()}.json`;
  const filePath = path.join(OUTPUT_DIR, fileName);
  let count = 0;
  let lastId: string | undefined;

  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  stream.write("[\n");

  while (true) {
    const where = lastId ? { id: { gt: lastId } } : undefined;
    const rows = await (prisma as unknown as Record<string, unknown>)[modelName].findMany({
      where,
      take: BATCH_SIZE,
      orderBy: { id: "asc" },
    });

    if (rows.length === 0) break;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (count > 0) stream.write(",\n");
      stream.write(JSON.stringify(row, null, 2));
      count += 1;
    }

    lastId = rows[rows.length - 1]?.id;
    if (rows.length < BATCH_SIZE) break;
  }

  stream.write("\n]\n");
  stream.close();

  return count;
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results: Record<string, { count: number; error?: string }> = {};
  for (const model of MODELS) {
    try {
      const count = await exportModel(model);
      results[model] = { count };
      console.log(`Exported ${model}: ${count} rows`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results[model] = { count: 0, error: message };
      console.log(`Skipped ${model}: ${message}`);
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "backup-summary.json"),
    JSON.stringify({ exportedAt: new Date().toISOString(), results }, null, 2)
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
