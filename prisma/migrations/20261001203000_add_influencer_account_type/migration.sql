-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INFLUENCER';

-- AlterTable
ALTER TABLE "influencers" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "influencers_userId_key" ON "influencers"("userId");

-- AddForeignKey
ALTER TABLE "influencers" ADD CONSTRAINT "influencers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
