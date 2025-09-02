-- CreateEnum
CREATE TYPE "BacklinkReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "article_versions" ADD COLUMN     "backlink_metadata" JSONB,
ADD COLUMN     "backlink_review_status" "BacklinkReviewStatus",
ADD COLUMN     "review_notes" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT;
