/*
  Warnings:

  - A unique constraint covering the columns `[scheduled_job_id]` on the table `article_versions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_session_id,article_id]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "article_versions" ADD COLUMN     "scheduled_by" TEXT,
ADD COLUMN     "scheduled_job_id" VARCHAR(255),
ADD COLUMN     "scheduled_publish_at" TIMESTAMPTZ,
ADD COLUMN     "scheduled_status" VARCHAR(30);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "scheduled_publish_at" TIMESTAMPTZ,
ADD COLUMN     "scheduled_status" VARCHAR(30),
ADD COLUMN     "session_type" TEXT NOT NULL DEFAULT 'PURCHASE',
ADD COLUMN     "stripe_session_id" TEXT;

-- CreateTable
CREATE TABLE "article_generation_sessions" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "generation_requests" JSONB NOT NULL,
    "total_articles" INTEGER NOT NULL DEFAULT 0,
    "total_price" DECIMAL(10,2) NOT NULL,
    "status" "PurchaseSessionStatus" NOT NULL DEFAULT 'PENDING_AUTH',
    "stripe_session_id" TEXT,
    "magic_link_token" TEXT NOT NULL,
    "magic_link_expires" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "article_generation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_generation_requests" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "domain_id" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "niche" TEXT,
    "keyword" TEXT,
    "target_url" TEXT NOT NULL,
    "anchor_text" TEXT NOT NULL,
    "notes" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "article_id" UUID,
    "order_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "article_generation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_generation_sessions_stripe_session_id_key" ON "article_generation_sessions"("stripe_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_generation_sessions_magic_link_token_key" ON "article_generation_sessions"("magic_link_token");

-- CreateIndex
CREATE UNIQUE INDEX "article_generation_requests_session_id_domain_id_topic_key" ON "article_generation_requests"("session_id", "domain_id", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "article_versions_scheduled_job_id_key" ON "article_versions"("scheduled_job_id");

-- CreateIndex
CREATE INDEX "article_versions_scheduled_publish_at_idx" ON "article_versions"("scheduled_publish_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_stripe_session_id_article_id_key" ON "orders"("stripe_session_id", "article_id");

-- AddForeignKey
ALTER TABLE "article_generation_requests" ADD CONSTRAINT "article_generation_requests_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_generation_requests" ADD CONSTRAINT "article_generation_requests_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
