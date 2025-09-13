const SessionService = require('./SessionService');
const prisma = require('../db/prisma');

// Mock Prisma
jest.mock('../db/prisma', () => ({
    purchaseSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn()
    },
    article: {
        updateMany: jest.fn()
    }
}));

describe('SessionService', () => {
    let sessionService;
    let mockDate;

    beforeEach(() => {
        sessionService = new SessionService();
        // Mock current time to 2024-01-01 12:00:00
        mockDate = new Date('2024-01-01T12:00:00Z');
        
        // Mock Date.now()
        jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());
        
        // Mock Date constructor to return mockDate when called without arguments
        const OriginalDate = Date;
        global.Date = jest.fn((dateString) => {
            if (dateString) {
                return new OriginalDate(dateString);
            }
            return mockDate;
        });
        global.Date.now = jest.fn(() => mockDate.getTime());
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        // Restore original Date
        global.Date = Date;
    });

    describe('createMagicLink', () => {
        const validSessionData = {
            articleId: 'article-123',
            backlinkData: {
                keyword: 'test keyword',
                target_url: 'https://example.com',
                notes: 'test notes'
            }
        };

        it('should create a magic link successfully', async () => {
            const mockSession = {
                id: 'session-123',
                email: 'test@example.com',
                article_id: 'article-123',
                magic_link_token: 'mock-token',
                magic_link_expires: new Date(mockDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            };

            prisma.purchaseSession.create.mockResolvedValue(mockSession);

            const result = await sessionService.createMagicLink('test@example.com', validSessionData);

            expect(result).toEqual({
                sessionId: 'session-123',
                token: expect.any(String),
                linkSent: true
            });

            // Verify the call was made with correct structure
            expect(prisma.purchaseSession.create).toHaveBeenCalledTimes(1);
            const callArgs = prisma.purchaseSession.create.mock.calls[0][0];
            expect(callArgs.data.email).toBe('test@example.com');
            expect(callArgs.data.article_id).toBe('article-123');
            expect(callArgs.data.backlink_data).toEqual(validSessionData.backlinkData);
            expect(callArgs.data.status).toBe('PENDING_AUTH');
            expect(typeof callArgs.data.magic_link_token).toBe('string');
            expect(callArgs.data.magic_link_token.length).toBe(64);
            expect(callArgs.data.magic_link_expires).toBeDefined();
            expect(callArgs.data.magic_link_expires.getTime()).toBeGreaterThan(mockDate.getTime());
        });

        it('should normalize email to lowercase and trim whitespace', async () => {
            const mockSession = {
                id: 'session-123',
                email: 'test@example.com',
                article_id: 'article-123'
            };

            prisma.purchaseSession.create.mockResolvedValue(mockSession);

            await sessionService.createMagicLink('  TEST@EXAMPLE.COM  ', validSessionData);

            expect(prisma.purchaseSession.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    email: 'test@example.com'
                })
            });
        });

        it('should throw error for invalid email', async () => {
            await expect(sessionService.createMagicLink('', validSessionData))
                .rejects.toThrow('Valid email is required');

            await expect(sessionService.createMagicLink(null, validSessionData))
                .rejects.toThrow('Valid email is required');
        });

        it('should throw error for missing session data', async () => {
            await expect(sessionService.createMagicLink('test@example.com', null))
                .rejects.toThrow('Session data is required');

            await expect(sessionService.createMagicLink('test@example.com', {}))
                .rejects.toThrow('Session data must include articleId and backlinkData');
        });

        it('should use custom expiry hours', async () => {
            const mockSession = {
                id: 'session-123',
                email: 'test@example.com',
                article_id: 'article-123'
            };

            prisma.purchaseSession.create.mockResolvedValue(mockSession);

            await sessionService.createMagicLink('test@example.com', validSessionData, 48);

            const expectedExpiry = new Date(mockDate.getTime() + 48 * 60 * 60 * 1000);
            expect(prisma.purchaseSession.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    magic_link_expires: expectedExpiry
                })
            });
        });

        it('should handle database errors', async () => {
            prisma.purchaseSession.create.mockRejectedValue(new Error('Database error'));

            await expect(sessionService.createMagicLink('test@example.com', validSessionData))
                .rejects.toThrow('Failed to create magic link: Database error');
        });
    });

    describe('verifyMagicLink', () => {

        it('should verify valid token successfully', async () => {
            const futureDate = new Date(mockDate.getTime() + 24 * 60 * 60 * 1000);
            const mockSession = {
                id: 'session-123',
                email: 'test@example.com',
                article_id: 'article-123',
                backlink_data: {
                    keyword: 'test keyword',
                    target_url: 'https://example.com'
                },
                status: 'PENDING_AUTH',
                magic_link_expires: futureDate,
                created_at: mockDate,
                article: {
                    id: 'article-123',
                    slug: 'test-article',
                    status: 'PUBLISHED',
                    availability_status: 'PROCESSING'
                }
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(mockSession);

            const result = await sessionService.verifyMagicLink('valid-token');

            expect(result.valid).toBe(true);
            expect(result.sessionData).toEqual({
                sessionId: 'session-123',
                email: 'test@example.com',
                articleId: 'article-123',
                backlinkData: mockSession.backlink_data,
                articleTitle: 'test-article',
                expiresAt: futureDate
            });
        });

        it('should reject invalid token', async () => {
            prisma.purchaseSession.findUnique.mockResolvedValue(null);

            const result = await sessionService.verifyMagicLink('invalid-token');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid or expired token');
        });

        it('should reject expired token', async () => {
            const expiredSession = {
                id: 'session-123',
                email: 'test@example.com',
                article_id: 'article-123',
                backlink_data: {
                    keyword: 'test keyword',
                    target_url: 'https://example.com'
                },
                status: 'PENDING_AUTH',
                magic_link_expires: new Date(mockDate.getTime() - 60 * 60 * 1000), // 1 hour ago
                created_at: mockDate,
                article: {
                    id: 'article-123',
                    slug: 'test-article',
                    status: 'PUBLISHED',
                    availability_status: 'PROCESSING'
                }
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(expiredSession);

            const result = await sessionService.verifyMagicLink('expired-token');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Token has expired');
        });

        it('should reject session in wrong state', async () => {
            const futureDate = new Date(mockDate.getTime() + 24 * 60 * 60 * 1000);
            const wrongStateSession = {
                id: 'session-123',
                email: 'test@example.com',
                article_id: 'article-123',
                backlink_data: {
                    keyword: 'test keyword',
                    target_url: 'https://example.com'
                },
                status: 'COMPLETED',
                magic_link_expires: futureDate,
                created_at: mockDate,
                article: {
                    id: 'article-123',
                    slug: 'test-article',
                    status: 'PUBLISHED',
                    availability_status: 'PROCESSING'
                }
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(wrongStateSession);

            const result = await sessionService.verifyMagicLink('wrong-state-token');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Session is not in valid state for authentication');
        });

        it('should reject unavailable article', async () => {
            const futureDate = new Date(mockDate.getTime() + 24 * 60 * 60 * 1000);
            const unavailableSession = {
                id: 'session-123',
                email: 'test@example.com',
                article_id: 'article-123',
                backlink_data: {
                    keyword: 'test keyword',
                    target_url: 'https://example.com'
                },
                status: 'PENDING_AUTH',
                magic_link_expires: futureDate,
                created_at: mockDate,
                article: {
                    id: 'article-123',
                    slug: 'test-article',
                    status: 'PUBLISHED',
                    availability_status: 'SOLD_OUT'
                }
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(unavailableSession);

            const result = await sessionService.verifyMagicLink('unavailable-token');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Article is no longer available for purchase');
        });

        it('should handle missing token', async () => {
            const result = await sessionService.verifyMagicLink('');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Token is required');
        });

        it('should handle database errors', async () => {
            prisma.purchaseSession.findUnique.mockRejectedValue(new Error('Database error'));

            const result = await sessionService.verifyMagicLink('test-token');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Failed to verify token');
        });
    });

    describe('extendSession', () => {
        it('should extend session successfully', async () => {
            const sessionExpiry = new Date(mockDate.getTime() + 24 * 60 * 60 * 1000);
            const mockSession = {
                id: 'session-123',
                magic_link_expires: sessionExpiry
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(mockSession);
            prisma.purchaseSession.update.mockResolvedValue({});

            const result = await sessionService.extendSession('session-123', 48);

            expect(result.success).toBe(true);
            expect(result.newExpiryDate).toEqual(
                new Date(sessionExpiry.getTime() + 48 * 60 * 60 * 1000)
            );

            expect(prisma.purchaseSession.update).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                data: { magic_link_expires: result.newExpiryDate }
            });
        });

        it('should extend from current time if session already expired', async () => {
            const expiredSession = {
                id: 'session-123',
                magic_link_expires: new Date(mockDate.getTime() - 60 * 60 * 1000) // 1 hour ago
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(expiredSession);
            prisma.purchaseSession.update.mockResolvedValue({});

            const result = await sessionService.extendSession('session-123', 24);

            expect(result.success).toBe(true);
            expect(result.newExpiryDate).toEqual(
                new Date(mockDate.getTime() + 24 * 60 * 60 * 1000)
            );
        });

        it('should handle missing session ID', async () => {
            const result = await sessionService.extendSession('');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Session ID is required');
        });

        it('should handle non-existent session', async () => {
            prisma.purchaseSession.findUnique.mockResolvedValue(null);

            const result = await sessionService.extendSession('non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Session not found');
        });
    });

    describe('validateSession', () => {

        it('should validate active session successfully', async () => {
            const futureDate = new Date(mockDate.getTime() + 24 * 60 * 60 * 1000);
            const mockSession = {
                id: 'session-123',
                email: 'test@example.com',
                status: 'AUTHENTICATED',
                article_id: 'article-123',
                backlink_data: { keyword: 'test' },
                magic_link_expires: futureDate,
                created_at: mockDate,
                article: {
                    id: 'article-123',
                    slug: 'test-article',
                    availability_status: 'PROCESSING'
                }
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(mockSession);

            const result = await sessionService.validateSession('session-123');

            expect(result.valid).toBe(true);
            expect(result.session).toEqual({
                id: 'session-123',
                email: 'test@example.com',
                status: 'AUTHENTICATED',
                articleId: 'article-123',
                backlinkData: { keyword: 'test' },
                expiresAt: futureDate,
                createdAt: mockDate
            });
        });

        it('should reject expired session', async () => {
            const expiredSession = {
                id: 'session-123',
                email: 'test@example.com',
                status: 'AUTHENTICATED',
                article_id: 'article-123',
                backlink_data: { keyword: 'test' },
                magic_link_expires: new Date(mockDate.getTime() - 60 * 60 * 1000),
                created_at: mockDate,
                article: {
                    id: 'article-123',
                    slug: 'test-article',
                    availability_status: 'PROCESSING'
                }
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(expiredSession);

            const result = await sessionService.validateSession('session-123');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Session has expired');
        });

        it('should reject session in invalid state', async () => {
            const futureDate = new Date(mockDate.getTime() + 24 * 60 * 60 * 1000);
            const invalidSession = {
                id: 'session-123',
                email: 'test@example.com',
                status: 'FAILED',
                article_id: 'article-123',
                backlink_data: { keyword: 'test' },
                magic_link_expires: futureDate,
                created_at: mockDate,
                article: {
                    id: 'article-123',
                    slug: 'test-article',
                    availability_status: 'PROCESSING'
                }
            };

            prisma.purchaseSession.findUnique.mockResolvedValue(invalidSession);

            const result = await sessionService.validateSession('session-123');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Session is in invalid state');
        });
    });

    describe('updateSessionStatus', () => {
        it('should update session status successfully', async () => {
            prisma.purchaseSession.update.mockResolvedValue({});

            const result = await sessionService.updateSessionStatus('session-123', 'AUTHENTICATED');

            expect(result.success).toBe(true);
            expect(prisma.purchaseSession.update).toHaveBeenCalledWith({
                where: { id: 'session-123' },
                data: { status: 'AUTHENTICATED' }
            });
        });

        it('should reject invalid status', async () => {
            const result = await sessionService.updateSessionStatus('session-123', 'INVALID_STATUS');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid status value');
        });

        it('should handle missing parameters', async () => {
            const result = await sessionService.updateSessionStatus('', 'AUTHENTICATED');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Session ID and status are required');
        });
    });

    describe('cleanupExpiredSessions', () => {
        it('should cleanup expired sessions successfully', async () => {
            const expiredSessions = [
                { id: 'session-1', article_id: 'article-1', email: 'test1@example.com' },
                { id: 'session-2', article_id: 'article-2', email: 'test2@example.com' }
            ];

            prisma.purchaseSession.findMany.mockResolvedValue(expiredSessions);
            prisma.purchaseSession.deleteMany.mockResolvedValue({ count: 2 });
            prisma.article.updateMany.mockResolvedValue({});

            const result = await sessionService.cleanupExpiredSessions();

            expect(result.cleaned).toBe(2);
            expect(prisma.purchaseSession.deleteMany).toHaveBeenCalledWith({
                where: { id: { in: ['session-1', 'session-2'] } }
            });
            expect(prisma.article.updateMany).toHaveBeenCalledWith({
                where: {
                    id: { in: ['article-1', 'article-2'] },
                    availability_status: 'PROCESSING'
                },
                data: { availability_status: 'AVAILABLE' }
            });
        });

        it('should handle no expired sessions', async () => {
            prisma.purchaseSession.findMany.mockResolvedValue([]);

            const result = await sessionService.cleanupExpiredSessions();

            expect(result.cleaned).toBe(0);
            expect(prisma.purchaseSession.deleteMany).not.toHaveBeenCalled();
        });

        it('should handle database errors', async () => {
            prisma.purchaseSession.findMany.mockRejectedValue(new Error('Database error'));

            const result = await sessionService.cleanupExpiredSessions();

            expect(result.cleaned).toBe(0);
            expect(result.error).toBe('Failed to cleanup expired sessions');
        });
    });

    describe('getSessionStats', () => {
        it('should return session statistics successfully', async () => {
            const mockStats = [
                { status: 'PENDING_AUTH', _count: { id: 5 } },
                { status: 'AUTHENTICATED', _count: { id: 3 } },
                { status: 'COMPLETED', _count: { id: 10 } }
            ];

            prisma.purchaseSession.groupBy.mockResolvedValue(mockStats);
            prisma.purchaseSession.count
                .mockResolvedValueOnce(2) // expired count
                .mockResolvedValueOnce(16); // active count

            const result = await sessionService.getSessionStats();

            expect(result).toEqual({
                byStatus: {
                    PENDING_AUTH: 5,
                    AUTHENTICATED: 3,
                    COMPLETED: 10
                },
                expired: 2,
                active: 16,
                total: 18
            });
        });

        it('should handle database errors', async () => {
            prisma.purchaseSession.groupBy.mockRejectedValue(new Error('Database error'));

            const result = await sessionService.getSessionStats();

            expect(result.error).toBe('Failed to get session statistics');
        });
    });

    describe('_generateSecureToken', () => {
        it('should generate a 64-character hex token', () => {
            const token = sessionService._generateSecureToken();

            expect(token).toMatch(/^[a-f0-9]{64}$/);
            expect(token.length).toBe(64);
        });

        it('should generate unique tokens', () => {
            const token1 = sessionService._generateSecureToken();
            const token2 = sessionService._generateSecureToken();

            expect(token1).not.toBe(token2);
        });
    });

    describe('_isValidEmail', () => {
        it('should validate correct email formats', () => {
            expect(sessionService._isValidEmail('test@example.com')).toBe(true);
            expect(sessionService._isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
            expect(sessionService._isValidEmail('simple@domain.org')).toBe(true);
        });

        it('should reject invalid email formats', () => {
            expect(sessionService._isValidEmail('invalid-email')).toBe(false);
            expect(sessionService._isValidEmail('missing@')).toBe(false);
            expect(sessionService._isValidEmail('@missing.com')).toBe(false);
            expect(sessionService._isValidEmail('spaces @domain.com')).toBe(false);
            expect(sessionService._isValidEmail('')).toBe(false);
        });
    });
});
 