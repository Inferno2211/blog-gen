const prisma = require('../db/prisma');
const crypto = require('crypto');

/**
 * SessionService - Handles session management and magic link authentication
 * Manages secure token generation, session validation, and cleanup operations
 */
class SessionService {
    constructor() {
        // Default session expiry: 7 days (very long as per requirements)
        this.defaultExpiryHours = 24 * 7; // 7 days
    }

    /**
     * Create a magic link for email authentication
     * @param {string} email - User email address
     * @param {Object} sessionData - Data to store in the session
     * @param {number} expiryHours - Optional custom expiry in hours (default: 7 days)
     * @returns {Promise<{sessionId: string, token: string, linkSent: boolean}>}
     */
    async createMagicLink(email, sessionData, expiryHours = this.defaultExpiryHours) {
        if (!email || typeof email !== 'string') {
            throw new Error('Valid email is required');
        }

        if (!sessionData || typeof sessionData !== 'object') {
            throw new Error('Session data is required');
        }

        // Validate required session data fields
        if (!sessionData.articleId || !sessionData.backlinkData) {
            throw new Error('Session data must include articleId and backlinkData');
        }

        try {
            // Generate secure token
            const token = this._generateSecureToken();
            const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

            // Create purchase session record
            const session = await prisma.purchaseSession.create({
                data: {
                    email: email.toLowerCase().trim(),
                    article_id: sessionData.articleId,
                    backlink_data: sessionData.backlinkData,
                    status: 'PENDING_AUTH',
                    magic_link_token: token,
                    magic_link_expires: expiresAt
                }
            });

            console.log(`Magic link created - Session: ${session.id}, Email: ${email}, Expires: ${expiresAt}`);

            return {
                sessionId: session.id,
                token: token,
                linkSent: true
            };
        } catch (error) {
            console.error('Failed to create magic link:', error);
            throw new Error(`Failed to create magic link: ${error.message}`);
        }
    }

    /**
     * Verify a magic link token and return session data
     * @param {string} token - The magic link token to verify
     * @returns {Promise<{valid: boolean, sessionData?: Object, error?: string}>}
     */
    async verifyMagicLink(token) {
        if (!token || typeof token !== 'string') {
            return { valid: false, error: 'Token is required' };
        }

        try {
            const session = await prisma.purchaseSession.findUnique({
                where: { magic_link_token: token },
                include: { 
                    article: {
                        select: {
                            id: true,
                            slug: true,
                            status: true,
                            availability_status: true
                        }
                    },
                    orders: {
                        select: {
                            id: true,
                            status: true
                        },
                        orderBy: {
                            created_at: 'desc'
                        },
                        take: 1
                    }
                }
            });

            if (!session) {
                return { valid: false, error: 'Invalid or expired token' };
            }

            // Check if token has expired
            if (new Date() > session.magic_link_expires) {
                console.log(`Expired token used - Session: ${session.id}, Expired: ${session.magic_link_expires}`);
                return { valid: false, error: 'Token has expired' };
            }

            // Check if session is in correct state for verification
            // Allow both PENDING_AUTH and PAID status for flexibility
            if (session.status !== 'PENDING_AUTH' && session.status !== 'PAID') {
                return { 
                    valid: false, 
                    error: `Session is not in valid state for authentication. Current status: ${session.status}`,
                    currentStatus: session.status
                };
            }

            // Verify article availability based on session status
            // If session is PAID, we don't need to check article availability
            if (session.status === 'PENDING_AUTH' && session.article.availability_status !== 'PROCESSING') {
                return { valid: false, error: 'Article is no longer available for purchase' };
            }

            console.log(`Magic link verified - Session: ${session.id}, Email: ${session.email}`);

            // Get order ID if session is paid
            const orderId = session.orders && session.orders.length > 0 ? session.orders[0].id : null;

            return {
                valid: true,
                sessionData: {
                    sessionId: session.id,
                    email: session.email,
                    articleId: session.article_id,
                    backlinkData: session.backlink_data,
                    articleTitle: session.article.slug,
                    expiresAt: session.magic_link_expires,
                    status: session.status,
                    orderId: orderId
                }
            };
        } catch (error) {
            console.error('Failed to verify magic link:', error);
            return { valid: false, error: 'Failed to verify token' };
        }
    }

    /**
     * Extend session expiry time
     * @param {string} sessionId - The session ID to extend
     * @param {number} additionalHours - Additional hours to extend (default: 7 days)
     * @returns {Promise<{success: boolean, newExpiryDate?: Date, error?: string}>}
     */
    async extendSession(sessionId, additionalHours = this.defaultExpiryHours) {
        if (!sessionId) {
            return { success: false, error: 'Session ID is required' };
        }

        try {
            const session = await prisma.purchaseSession.findUnique({
                where: { id: sessionId }
            });

            if (!session) {
                return { success: false, error: 'Session not found' };
            }

            // Calculate new expiry date
            const currentExpiry = new Date(session.magic_link_expires);
            const now = new Date();
            const baseTime = currentExpiry > now ? currentExpiry : now;
            const newExpiryDate = new Date(baseTime.getTime() + additionalHours * 60 * 60 * 1000);

            // Update session expiry
            await prisma.purchaseSession.update({
                where: { id: sessionId },
                data: { magic_link_expires: newExpiryDate }
            });

            console.log(`Session extended - Session: ${sessionId}, New expiry: ${newExpiryDate}`);

            return {
                success: true,
                newExpiryDate: newExpiryDate
            };
        } catch (error) {
            console.error('Failed to extend session:', error);
            return { success: false, error: 'Failed to extend session' };
        }
    }

    /**
     * Validate if a session is still active and valid
     * @param {string} sessionId - The session ID to validate
     * @returns {Promise<{valid: boolean, session?: Object, error?: string}>}
     */
    async validateSession(sessionId) {
        if (!sessionId) {
            return { valid: false, error: 'Session ID is required' };
        }

        try {
            const session = await prisma.purchaseSession.findUnique({
                where: { id: sessionId },
                include: {
                    article: {
                        select: {
                            id: true,
                            slug: true,
                            availability_status: true
                        }
                    }
                }
            });

            if (!session) {
                return { valid: false, error: 'Session not found' };
            }

            // Check if session has expired
            if (new Date() > session.magic_link_expires) {
                return { valid: false, error: 'Session has expired' };
            }

            // Check if session is in a valid state
            const validStates = ['PENDING_AUTH', 'AUTHENTICATED', 'PAYMENT_PENDING', 'PAID'];
            if (!validStates.includes(session.status)) {
                return { valid: false, error: 'Session is in invalid state' };
            }

            return {
                valid: true,
                session: {
                    id: session.id,
                    email: session.email,
                    status: session.status,
                    articleId: session.article_id,
                    backlinkData: session.backlink_data,
                    expiresAt: session.magic_link_expires,
                    createdAt: session.created_at
                }
            };
        } catch (error) {
            console.error('Failed to validate session:', error);
            return { valid: false, error: 'Failed to validate session' };
        }
    }

    /**
     * Update session status
     * @param {string} sessionId - The session ID to update
     * @param {string} status - New status value
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async updateSessionStatus(sessionId, status) {
        if (!sessionId || !status) {
            return { success: false, error: 'Session ID and status are required' };
        }

        const validStatuses = ['PENDING_AUTH', 'AUTHENTICATED', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'FAILED'];
        if (!validStatuses.includes(status)) {
            return { success: false, error: 'Invalid status value' };
        }

        try {
            await prisma.purchaseSession.update({
                where: { id: sessionId },
                data: { status: status }
            });

            console.log(`Session status updated - Session: ${sessionId}, Status: ${status}`);

            return { success: true };
        } catch (error) {
            console.error('Failed to update session status:', error);
            return { success: false, error: 'Failed to update session status' };
        }
    }

    /**
     * Clean up expired sessions
     * @param {number} batchSize - Number of sessions to clean up in one batch (default: 100)
     * @returns {Promise<{cleaned: number, error?: string}>}
     */
    async cleanupExpiredSessions(batchSize = 100) {
        try {
            const now = new Date();
            
            // Find expired sessions
            const expiredSessions = await prisma.purchaseSession.findMany({
                where: {
                    magic_link_expires: {
                        lt: now
                    },
                    status: {
                        in: ['PENDING_AUTH', 'AUTHENTICATED', 'PAYMENT_PENDING']
                    }
                },
                take: batchSize,
                select: {
                    id: true,
                    article_id: true,
                    email: true,
                    magic_link_expires: true
                }
            });

            if (expiredSessions.length === 0) {
                return { cleaned: 0 };
            }

            // Get session IDs for deletion
            const sessionIds = expiredSessions.map(s => s.id);
            const articleIds = [...new Set(expiredSessions.map(s => s.article_id))];

            // Delete expired sessions
            const deleteResult = await prisma.purchaseSession.deleteMany({
                where: {
                    id: {
                        in: sessionIds
                    }
                }
            });

            // Reset article availability for articles that had expired sessions
            await prisma.article.updateMany({
                where: {
                    id: {
                        in: articleIds
                    },
                    availability_status: 'PROCESSING'
                },
                data: {
                    availability_status: 'AVAILABLE'
                }
            });

            console.log(`Cleaned up ${deleteResult.count} expired sessions, reset ${articleIds.length} articles to available`);

            return { cleaned: deleteResult.count };
        } catch (error) {
            console.error('Failed to cleanup expired sessions:', error);
            return { cleaned: 0, error: 'Failed to cleanup expired sessions' };
        }
    }

    /**
     * Get session statistics
     * @returns {Promise<Object>} Session statistics
     */
    async getSessionStats() {
        try {
            const now = new Date();
            
            const stats = await prisma.purchaseSession.groupBy({
                by: ['status'],
                _count: {
                    id: true
                }
            });

            const expiredCount = await prisma.purchaseSession.count({
                where: {
                    magic_link_expires: {
                        lt: now
                    }
                }
            });

            const activeCount = await prisma.purchaseSession.count({
                where: {
                    magic_link_expires: {
                        gte: now
                    }
                }
            });

            return {
                byStatus: stats.reduce((acc, stat) => {
                    acc[stat.status] = stat._count.id;
                    return acc;
                }, {}),
                expired: expiredCount,
                active: activeCount,
                total: expiredCount + activeCount
            };
        } catch (error) {
            console.error('Failed to get session stats:', error);
            return { error: 'Failed to get session statistics' };
        }
    }

    // Private helper methods

    /**
     * Generate a cryptographically secure token
     * @private
     * @returns {string} Secure random token
     */
    _generateSecureToken() {
        // Generate 32 bytes of random data and convert to hex (64 characters)
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Validate email format
     * @private
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email format
     */
    _isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

module.exports = SessionService;