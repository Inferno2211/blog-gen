-- CreateEnum
CREATE TYPE "ArticleAvailabilityStatus" AS ENUM ('AVAILABLE', 'SOLD_OUT', 'PROCESSING');

-- CreateEnum
CREATE TYPE "PurchaseSessionStatus" AS ENUM ('PENDING_AUTH', 'AUTHENTICATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PROCESSING', 'QUALITY_CHECK', 'ADMIN_REVIEW', 'COMPLETED', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "availability_status" "ArticleAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "last_backlink_added" TIMESTAMPTZ,
ADD COLUMN     "pending_backlink_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "purchase_sessions" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "article_id" UUID NOT NULL,
    "backlink_data" JSONB NOT NULL,
    "status" "PurchaseSessionStatus" NOT NULL DEFAULT 'PENDING_AUTH',
    "stripe_session_id" TEXT,
    "magic_link_token" TEXT NOT NULL,
    "magic_link_expires" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "version_id" UUID,
    "customer_email" TEXT NOT NULL,
    "backlink_data" JSONB NOT NULL,
    "payment_data" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PROCESSING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_sessions_magic_link_token_key" ON "purchase_sessions"("magic_link_token");

-- AddForeignKey
ALTER TABLE "purchase_sessions" ADD CONSTRAINT "purchase_sessions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "purchase_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "article_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
