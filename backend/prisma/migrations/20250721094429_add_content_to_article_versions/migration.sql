-- AlterTable
ALTER TABLE "article_versions" ADD COLUMN     "content" TEXT,
ALTER COLUMN "file_path" DROP NOT NULL;
