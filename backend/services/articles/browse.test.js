const { getBrowseArticles, getArticleAvailability, updateArticleAvailability, generateArticlePreview } = require('./dbCrud');
const prisma = require('../../db/prisma');

// Mock Prisma
jest.mock('../../db/prisma', () => ({
    article: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
    }
}));

describe('Article Browse and Availability Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getBrowseArticles', () => {
        it('should return published articles with preview data', async () => {
            const mockArticles = [
                {
                    id: 'article-1',
                    slug: 'test-article',
                    topic: 'Test Topic',
                    niche: 'Technology',
                    keyword: 'test keyword',
                    availability_status: 'AVAILABLE',
                    pending_backlink_count: 0,
                    last_backlink_added: null,
                    created_at: new Date('2024-01-01'),
                    domain: {
                        name: 'Test Domain',
                        slug: 'test-domain'
                    },
                    selected_version: {
                        id: 'version-1',
                        content_md: '# Test Article\n\nThis is test content for the article.',
                        created_at: new Date('2024-01-01')
                    }
                }
            ];

            prisma.article.findMany.mockResolvedValue(mockArticles);

            const result = await getBrowseArticles();

            expect(prisma.article.findMany).toHaveBeenCalledWith({
                where: {
                    status: 'PUBLISHED'
                },
                select: {
                    id: true,
                    slug: true,
                    topic: true,
                    niche: true,
                    keyword: true,
                    availability_status: true,
                    pending_backlink_count: true,
                    last_backlink_added: true,
                    created_at: true,
                    domain: {
                        select: {
                            name: true,
                            slug: true
                        }
                    },
                    selected_version: {
                        select: {
                            id: true,
                            content_md: true,
                            created_at: true
                        }
                    }
                },
                orderBy: {
                    created_at: 'desc'
                }
            });

            expect(result).toEqual(mockArticles);
        });
    });

    describe('getArticleAvailability', () => {
        it('should return available true for published available article', async () => {
            const mockArticle = {
                id: 'article-1',
                availability_status: 'AVAILABLE',
                pending_backlink_count: 0,
                status: 'PUBLISHED'
            };

            prisma.article.findUnique.mockResolvedValue(mockArticle);

            const result = await getArticleAvailability('article-1');

            expect(result).toEqual({ available: true });
        });

        it('should return available false for non-existent article', async () => {
            prisma.article.findUnique.mockResolvedValue(null);

            const result = await getArticleAvailability('non-existent');

            expect(result).toEqual({ 
                available: false, 
                reason: 'Article not found' 
            });
        });

        it('should return available false for unpublished article', async () => {
            const mockArticle = {
                id: 'article-1',
                availability_status: 'AVAILABLE',
                pending_backlink_count: 0,
                status: 'DRAFT'
            };

            prisma.article.findUnique.mockResolvedValue(mockArticle);

            const result = await getArticleAvailability('article-1');

            expect(result).toEqual({ 
                available: false, 
                reason: 'Article not published' 
            });
        });

        it('should return available false for sold out article', async () => {
            const mockArticle = {
                id: 'article-1',
                availability_status: 'SOLD_OUT',
                pending_backlink_count: 1,
                status: 'PUBLISHED'
            };

            prisma.article.findUnique.mockResolvedValue(mockArticle);

            const result = await getArticleAvailability('article-1');

            expect(result).toEqual({ 
                available: false, 
                reason: 'Article sold out - backlink pending review' 
            });
        });

        it('should return available false for processing article', async () => {
            const mockArticle = {
                id: 'article-1',
                availability_status: 'PROCESSING',
                pending_backlink_count: 0,
                status: 'PUBLISHED'
            };

            prisma.article.findUnique.mockResolvedValue(mockArticle);

            const result = await getArticleAvailability('article-1');

            expect(result).toEqual({ 
                available: false, 
                reason: 'Article currently being processed' 
            });
        });
    });

    describe('updateArticleAvailability', () => {
        it('should update article availability status', async () => {
            const mockUpdatedArticle = {
                id: 'article-1',
                availability_status: 'SOLD_OUT',
                updated_at: new Date()
            };

            prisma.article.update.mockResolvedValue(mockUpdatedArticle);

            const result = await updateArticleAvailability('article-1', 'SOLD_OUT');

            expect(prisma.article.update).toHaveBeenCalledWith({
                where: { id: 'article-1' },
                data: { 
                    availability_status: 'SOLD_OUT',
                    updated_at: expect.any(Date)
                }
            });

            expect(result).toEqual(mockUpdatedArticle);
        });
    });

    describe('generateArticlePreview', () => {
        it('should generate preview with title and content', () => {
            const mockArticle = {
                id: 'article-1',
                slug: 'test-article',
                topic: 'Test Topic',
                niche: 'Technology',
                keyword: 'test keyword',
                availability_status: 'AVAILABLE',
                created_at: new Date('2024-01-01'),
                domain: {
                    name: 'Test Domain'
                },
                selected_version: {
                    content_md: '# Test Article Title\n\nThis is the first paragraph of the article content. It should be used as the preview text.'
                }
            };

            const result = generateArticlePreview(mockArticle);

            expect(result).toEqual({
                id: 'article-1',
                slug: 'test-article',
                title: 'Test Article Title',
                preview: 'This is the first paragraph of the article content. It should be used as the preview text.',
                availability_status: 'AVAILABLE',
                domain: 'Test Domain',
                niche: 'Technology',
                keyword: 'test keyword',
                created_at: new Date('2024-01-01'),
                last_backlink_added: undefined
            });
        });

        it('should handle article without content', () => {
            const mockArticle = {
                id: 'article-1',
                slug: 'test-article',
                topic: 'Test Topic',
                availability_status: 'AVAILABLE',
                created_at: new Date('2024-01-01'),
                domain: {
                    name: 'Test Domain'
                },
                selected_version: null
            };

            const result = generateArticlePreview(mockArticle);

            expect(result).toEqual({
                id: 'article-1',
                slug: 'test-article',
                title: 'Test Topic',
                preview: 'No content available',
                availability_status: 'AVAILABLE',
                domain: 'Test Domain',
                created_at: new Date('2024-01-01')
            });
        });

        it('should truncate long preview text', () => {
            const longContent = 'A'.repeat(250);
            const mockArticle = {
                id: 'article-1',
                slug: 'test-article',
                topic: 'Test Topic',
                availability_status: 'AVAILABLE',
                created_at: new Date('2024-01-01'),
                domain: {
                    name: 'Test Domain'
                },
                selected_version: {
                    content_md: `# Test Title\n\n${longContent}`
                }
            };

            const result = generateArticlePreview(mockArticle);

            expect(result.preview).toHaveLength(203); // 200 chars + '...'
            expect(result.preview.endsWith('...')).toBe(true);
        });

        it('should use topic as title when no markdown title found', () => {
            const mockArticle = {
                id: 'article-1',
                slug: 'test-article',
                topic: 'Fallback Topic',
                availability_status: 'AVAILABLE',
                created_at: new Date('2024-01-01'),
                domain: {
                    name: 'Test Domain'
                },
                selected_version: {
                    content_md: 'Content without title heading'
                }
            };

            const result = generateArticlePreview(mockArticle);

            expect(result.title).toBe('Fallback Topic');
        });
    });
});