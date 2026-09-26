-- CreateTable
CREATE TABLE IF NOT EXISTS "vendor_posts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "vendorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_posts_vendorId_idx" ON "vendor_posts"("vendorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_posts_storeId_idx" ON "vendor_posts"("storeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_posts_createdAt_idx" ON "vendor_posts"("createdAt");

-- AddForeignKey
ALTER TABLE "vendor_posts" ADD CONSTRAINT "vendor_posts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_posts" ADD CONSTRAINT "vendor_posts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "vendor_post_likes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_post_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_post_likes_postId_userId_key" ON "vendor_post_likes"("postId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_post_likes_postId_idx" ON "vendor_post_likes"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_post_likes_userId_idx" ON "vendor_post_likes"("userId");

-- AddForeignKey
ALTER TABLE "vendor_post_likes" ADD CONSTRAINT "vendor_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vendor_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_post_likes" ADD CONSTRAINT "vendor_post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "vendor_post_comments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_post_comments_postId_idx" ON "vendor_post_comments"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_post_comments_userId_idx" ON "vendor_post_comments"("userId");

-- AddForeignKey
ALTER TABLE "vendor_post_comments" ADD CONSTRAINT "vendor_post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vendor_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_post_comments" ADD CONSTRAINT "vendor_post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "vendor_post_reports" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_post_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_post_reports_postId_idx" ON "vendor_post_reports"("postId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendor_post_reports_userId_idx" ON "vendor_post_reports"("userId");

-- AddForeignKey
ALTER TABLE "vendor_post_reports" ADD CONSTRAINT "vendor_post_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vendor_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_post_reports" ADD CONSTRAINT "vendor_post_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
