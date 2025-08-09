# Project Specification: AI-Powered PBN Platform

## 1. Overview
Build an AI-first Private Blog Network (PBN) platform that auto-generates SEO-optimized articles with backlinks, supports external client orders, and delivers static site ZIP packages per domain for deployment.

## 2. Features
- **Order Intake**: Domain selection, keyword/topic input, payment via Stripe/PayPal.  
- **AI Generation**: Produce 3 draft markdown articles per order, matching domain niche and embedding backlinks.  
- **Quality Check**: AI-driven QC agent with retry (≤3 attempts), flagging or auto-regeneration for issues (tone, banned topics, missing link).  
- **Versioning**: Maintain `articles` and `article_versions` tables; support manual or AI/human approvals.  
- **Content Management**: Write approved markdown to domain-specific Astro content folders; manage images via `/public/uploads`.  
- **Static Site Build**: Programmatically `npm run build` per domain Astro project, zip `/dist`, expose preview and download endpoints.  
- **Admin Dashboard**: Track projects (domains), articles, backlink statuses, expiry, and renewal workflows.

## 3. Technologies
- **Backend**: Node.js, Express, PostgreSQL (Prisma/TypeORM optional)  
- **AI**: OpenAI API or local LLM (vLLM/OpenRouter)  
- **SSG**: Astro with Tailwind CSS theme (one project per domain)  
- **Storage**: Local filesystem for builds/uploads (future: S3/Cloudflare)  
- **CI/CD**: GitHub Actions or Cursor pipeline

## 4. Services

AIService

generateMarkdown(orderData) → Promise<string>

QCService

runQC(versionId) → { status, notes }

Retries up to 3 times (increment qc_attempts).

VersionService

createVersion(articleId, contentMd)

markVersionSelected(articleId, versionId)

ContentService

writeMarkdownFile(domainSlug, articleSlug, contentMd)

uploadImages(domainSlug, articleSlug, images[])

BuildService

buildDomain(domainSlug) → distPath

zipDomainBuild(domainSlug) → zipPath

PublishService

Expose /preview/:domainSlug/:articleSlug via Express static or Markdown‑to‑HTML.

Expose /download/:domainSlug.zip.