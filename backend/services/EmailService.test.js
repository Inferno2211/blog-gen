const EmailService = require('./EmailService');
const { AppError } = require('./errors');

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn()
    }
  }))
}));

describe('EmailService', () => {
  let emailService;
  let mockResendSend;

  beforeEach(() => {
    // Reset environment variables
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.FROM_EMAIL = 'test@example.com';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    emailService = new EmailService();
    mockResendSend = emailService.resend.emails.send;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(emailService.fromEmail).toBe('test@example.com');
      expect(emailService.maxRetries).toBe(3);
      expect(emailService.retryDelay).toBe(1000);
    });

    it('should use default from email if not provided', () => {
      delete process.env.FROM_EMAIL;
      const service = new EmailService();
      expect(service.fromEmail).toBe('noreply@yourdomain.com');
    });
  });

  describe('sendMagicLink', () => {
    const testEmail = 'user@example.com';
    const testToken = 'test-token-123';
    const testSessionData = {
      articleTitle: 'Test Article',
      keyword: 'test keyword',
      targetUrl: 'https://example.com'
    };

    it('should send magic link email successfully', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      const result = await emailService.sendMagicLink(testEmail, testToken, testSessionData);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: testEmail,
        subject: 'Complete Your Article Purchase - Magic Link Authentication',
        html: expect.stringContaining('Complete Your Purchase')
      });

      expect(result).toEqual({
        success: true,
        emailId: 'email-123',
        attempt: 1,
        type: 'magic_link'
      });
    });

    it('should include session data in email template', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      await emailService.sendMagicLink(testEmail, testToken, testSessionData);

      const emailCall = mockResendSend.mock.calls[0][0];
      expect(emailCall.html).toContain('Test Article');
      expect(emailCall.html).toContain('test keyword');
      expect(emailCall.html).toContain('https://example.com');
      expect(emailCall.html).toContain(`/verify?token=${testToken}`);
    });

    it('should retry on failure and eventually succeed', async () => {
      mockResendSend
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: { id: 'email-123' } });

      const result = await emailService.sendMagicLink(testEmail, testToken, testSessionData);

      expect(mockResendSend).toHaveBeenCalledTimes(2);
      expect(result.attempt).toBe(2);
    });

    it('should throw AppError after max retries', async () => {
      mockResendSend.mockRejectedValue(new Error('Persistent error'));

      await expect(
        emailService.sendMagicLink(testEmail, testToken, testSessionData)
      ).rejects.toThrow(AppError);

      expect(mockResendSend).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const authError = new Error('Unauthorized');
      authError.statusCode = 401;
      mockResendSend.mockRejectedValue(authError);

      await expect(
        emailService.sendMagicLink(testEmail, testToken, testSessionData)
      ).rejects.toThrow(AppError);

      expect(mockResendSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendOrderConfirmation', () => {
    const testEmail = 'user@example.com';
    const testOrderData = {
      id: 'order-123',
      articleTitle: 'Test Article',
      backlink_data: {
        keyword: 'test keyword',
        target_url: 'https://example.com'
      },
      created_at: new Date('2024-01-01T00:00:00Z')
    };

    it('should send order confirmation email successfully', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      const result = await emailService.sendOrderConfirmation(testEmail, testOrderData);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: testEmail,
        subject: 'Order Confirmation - Article Backlink Purchase #order-123',
        html: expect.stringContaining('Order Confirmed!')
      });

      expect(result.type).toBe('order_confirmation');
    });

    it('should include order details in email template', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      await emailService.sendOrderConfirmation(testEmail, testOrderData);

      const emailCall = mockResendSend.mock.calls[0][0];
      expect(emailCall.html).toContain('order-123');
      expect(emailCall.html).toContain('test keyword');
      expect(emailCall.html).toContain('https://example.com');
      expect(emailCall.html).toContain('$15.00');
    });
  });

  describe('sendCompletionNotification', () => {
    const testEmail = 'user@example.com';
    const testArticleData = {
      title: 'Published Article',
      slug: 'published-article',
      published_at: new Date('2024-01-01T00:00:00Z'),
      backlinkData: {
        keyword: 'test keyword',
        targetUrl: 'https://example.com'
      }
    };

    it('should send completion notification email successfully', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      const result = await emailService.sendCompletionNotification(testEmail, testArticleData);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: testEmail,
        subject: 'Your Article is Live! - Backlink Successfully Added',
        html: expect.stringContaining('Your Article is Live!')
      });

      expect(result.type).toBe('completion_notification');
    });

    it('should include article details and view link in email template', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      await emailService.sendCompletionNotification(testEmail, testArticleData);

      const emailCall = mockResendSend.mock.calls[0][0];
      expect(emailCall.html).toContain('Published Article');
      expect(emailCall.html).toContain('/articles/published-article');
      expect(emailCall.html).toContain('test keyword');
      expect(emailCall.html).toContain('https://example.com');
      expect(emailCall.html).toContain('Dofollow');
    });
  });

  describe('sendRefundNotification', () => {
    const testEmail = 'user@example.com';
    const testOrderData = {
      id: 'order-123'
    };
    const testReason = 'Quality standards not met';

    it('should send refund notification email successfully', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      const result = await emailService.sendRefundNotification(testEmail, testOrderData, testReason);

      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: testEmail,
        subject: 'Refund Processed - Order #order-123',
        html: expect.stringContaining('Refund Processed')
      });

      expect(result.type).toBe('refund_notification');
    });

    it('should include refund details and reason in email template', async () => {
      mockResendSend.mockResolvedValue({
        data: { id: 'email-123' }
      });

      await emailService.sendRefundNotification(testEmail, testOrderData, testReason);

      const emailCall = mockResendSend.mock.calls[0][0];
      expect(emailCall.html).toContain('order-123');
      expect(emailCall.html).toContain('Quality standards not met');
      expect(emailCall.html).toContain('$15.00');
      expect(emailCall.html).toContain('5-10 business days');
    });
  });

  describe('_sendEmailWithRetry', () => {
    it('should implement exponential backoff', async () => {
      const sleepSpy = jest.spyOn(emailService, '_sleep').mockResolvedValue();
      
      mockResendSend
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({ data: { id: 'email-123' } });

      await emailService._sendEmailWithRetry({
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'Test',
        html: 'Test'
      }, 'test');

      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000); // First retry: 1s
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000); // Second retry: 2s

      sleepSpy.mockRestore();
    });
  });

  describe('_isNonRetryableError', () => {
    it('should identify non-retryable status codes', () => {
      const retryableError = new Error('Server error');
      retryableError.statusCode = 500;
      
      const nonRetryableError = new Error('Bad request');
      nonRetryableError.statusCode = 400;

      expect(emailService._isNonRetryableError(retryableError)).toBe(false);
      expect(emailService._isNonRetryableError(nonRetryableError)).toBe(true);
    });

    it('should handle errors without status codes', () => {
      const error = new Error('Network error');
      expect(emailService._isNonRetryableError(error)).toBe(false);
    });
  });

  describe('_sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await emailService._sleep(100);
      const elapsed = Date.now() - start;
      
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('email templates', () => {
    beforeEach(() => {
      mockResendSend.mockResolvedValue({ data: { id: 'email-123' } });
    });

    it('should generate valid HTML for magic link template', async () => {
      await emailService.sendMagicLink('user@example.com', 'token', {
        articleTitle: 'Test Article',
        keyword: 'keyword',
        targetUrl: 'https://example.com'
      });

      const html = mockResendSend.mock.calls[0][0].html;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('Complete Your Purchase');
    });

    it('should generate valid HTML for order confirmation template', async () => {
      await emailService.sendOrderConfirmation('user@example.com', {
        id: 'order-123',
        backlink_data: { keyword: 'test', target_url: 'https://example.com' },
        created_at: new Date()
      });

      const html = mockResendSend.mock.calls[0][0].html;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Order Confirmed!');
    });

    it('should generate valid HTML for completion template', async () => {
      await emailService.sendCompletionNotification('user@example.com', {
        title: 'Article',
        slug: 'article',
        published_at: new Date(),
        backlinkData: { keyword: 'test', targetUrl: 'https://example.com' }
      });

      const html = mockResendSend.mock.calls[0][0].html;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Your Article is Live!');
    });

    it('should generate valid HTML for refund template', async () => {
      await emailService.sendRefundNotification('user@example.com', {
        id: 'order-123'
      }, 'Test reason');

      const html = mockResendSend.mock.calls[0][0].html;
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Refund Processed');
    });
  });
});