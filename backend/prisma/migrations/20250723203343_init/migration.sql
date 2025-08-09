/*
  Warnings:

  - You are about to drop the column `content` on the `article_versions` table. All the data in the column will be lost.
  - You are about to drop the column `created` on the `article_versions` table. All the data in the column will be lost.
  - You are about to drop the column `file_path` on the `article_versions` table. All the data in the column will be lost.
  - You are about to drop the column `anchor_text` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `backlink` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `created` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `desc` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `domain` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `file_path` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `keyword` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `niche` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `order_id` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `published` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `selected_version` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `topic` on the `articles` table. All the data in the column will be lost.
  - You are about to drop the column `updated` on the `articles` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[selected_version_id]` on the table `articles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `content_md` to the `article_versions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `domain_id` to the `articles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `articles` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `articles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "article_versions" DROP COLUMN "content",
DROP COLUMN "created",
DROP COLUMN "file_path",
ADD COLUMN     "content_md" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_qc_notes" JSONB,
ADD COLUMN     "last_qc_status" TEXT,
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "qc_attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "articles" DROP COLUMN "anchor_text",
DROP COLUMN "backlink",
DROP COLUMN "content",
DROP COLUMN "created",
DROP COLUMN "desc",
DROP COLUMN "domain",
DROP COLUMN "file_path",
DROP COLUMN "keyword",
DROP COLUMN "niche",
DROP COLUMN "order_id",
DROP COLUMN "published",
DROP COLUMN "selected_version",
DROP COLUMN "title",
DROP COLUMN "topic",
DROP COLUMN "updated",
ADD COLUMN     "baclink_expiry" TIMESTAMPTZ,
ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "domain_id" UUID NOT NULL,
ADD COLUMN     "selected_version_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL,
ADD COLUMN     "user" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Domain" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "tags" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_slug_key" ON "Domain"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "articles_selected_version_id_key" ON "articles"("selected_version_id");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_selected_version_id_fkey" FOREIGN KEY ("selected_version_id") REFERENCES "article_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
