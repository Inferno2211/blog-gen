const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create sample articles
  const article1 = await prisma.article.create({
    data: {
      slug: 'getting-started-with-ai-content',
      title: 'Getting Started with AI Content Generation',
      desc: 'A comprehensive guide to using AI for content creation in 2025',
      niche: 'Technology',
      topic: 'AI Content',
      keyword: 'AI content generation',
      backlink: 'https://example.com/ai-tools',
      anchorText: 'AI content tools',
      filePath: '/files/blogs/ai-content-guide.md',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      domain: 'techblog.com'
    }
  });

  const article2 = await prisma.article.create({
    data: {
      slug: 'productivity-tips-remote-work',
      title: 'Top Productivity Tips for Remote Workers',
      desc: 'Essential strategies to stay productive while working from home',
      niche: 'Productivity',
      topic: 'Remote Work',
      keyword: 'remote work productivity',
      filePath: '/files/blogs/remote-productivity.md',
      status: 'DRAFT',
      domain: 'productivity.com'
    }
  });

  // Create versions for the first article
  const version1 = await prisma.articleVersion.create({
    data: {
      articleId: article1.id,
      version: 1,
      filePath: '/files/blogs/ai-content-guide-v1.md'
    }
  });

  const version2 = await prisma.articleVersion.create({
    data: {
      articleId: article1.id,
      version: 2,
      filePath: '/files/blogs/ai-content-guide-v2.md'
    }
  });

  // Set the second version as selected
  await prisma.article.update({
    where: { id: article1.id },
    data: { selectedVersion: version2.id }
  });

  // Create a version for the second article
  const version3 = await prisma.articleVersion.create({
    data: {
      articleId: article2.id,
      version: 1,
      filePath: '/files/blogs/remote-productivity-v1.md'
    }
  });

  await prisma.article.update({
    where: { id: article2.id },
    data: { selectedVersion: version3.id }
  });

  console.log('✅ Database seeding completed successfully!');
  console.log(`📄 Created ${await prisma.article.count()} articles`);
  console.log(`📑 Created ${await prisma.articleVersion.count()} article versions`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 