-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "anchor" TEXT,
ADD COLUMN     "backlink_target" TEXT,
ADD COLUMN     "keyword" TEXT,
ADD COLUMN     "niche" TEXT,
ADD COLUMN     "topic" TEXT;
