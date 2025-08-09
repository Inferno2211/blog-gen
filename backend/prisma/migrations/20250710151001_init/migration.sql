-- CreateEnum
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING');

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "order_id" INTEGER,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "desc" TEXT,
    "niche" TEXT,
    "topic" TEXT,
    "keyword" TEXT,
    "backlink" TEXT,
    "anchor_text" TEXT,
    "file_path" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated" TIMESTAMPTZ NOT NULL,
    "published" TIMESTAMPTZ,
    "domain" TEXT,
    "selected_version" UUID,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_versions" (
    "id" UUID NOT NULL,
    "article_id" UUID NOT NULL,
    "version_num" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "created" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_slug_key" ON "articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "article_versions_article_id_version_num_key" ON "article_versions"("article_id", "version_num");

-- AddForeignKey
ALTER TABLE "article_versions" ADD CONSTRAINT "article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
