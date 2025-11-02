-- AlterTable
ALTER TABLE "purchase_sessions" ADD COLUMN     "cart_items" JSONB,
ADD COLUMN     "purchase_type" TEXT NOT NULL DEFAULT 'BACKLINK',
ALTER COLUMN "article_id" DROP NOT NULL,
ALTER COLUMN "backlink_data" DROP NOT NULL;
