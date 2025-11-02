const sgMail = require('@sendgrid/mail');
const { AppError } = require('./errors');

class EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@yourdomain.com';
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
  }

  /**
   * Send magic link authentication email
   * @param {string} email - Recipient email address
   * @param {string} token - Magic link token
   * @param {Object} sessionData - Session data for context
   * @returns {Promise<Object>} Email send result
   */
  async sendMagicLink(email, token, sessionData) {
    const magicLinkUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify?token=${token}`;
    
    const subject = sessionData.type === 'article_generation' 
      ? 'Complete Your Article Generation Order - Magic Link Authentication'
      : 'Complete Your Article Purchase - Magic Link Authentication';

    const emailData = {
      from: this.fromEmail,
      to: email,
      subject: subject,
      html: this._generateMagicLinkTemplate(magicLinkUrl, sessionData)
    };

    return this._sendEmailWithRetry(emailData, 'magic_link');
  }

  /**
   * Send order confirmation email
   * @param {string} email - Customer email
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Email send result
   */
  async sendOrderConfirmation(email, orderData) {
    const emailData = {
      from: this.fromEmail,
      to: email,
      subject: `Order Confirmation - Article Backlink Purchase #${orderData.id}`,
      html: this._generateOrderConfirmationTemplate(orderData)
    };

    return this._sendEmailWithRetry(emailData, 'order_confirmation');
  }

  /**
   * Send completion notification email
   * @param {string} email - Customer email
   * @param {Object} articleData - Published article details
   * @param {string} type - Type of completion ('backlink' or 'article_generation')
   * @returns {Promise<Object>} Email send result
   */
  async sendCompletionNotification(email, articleData, type = 'backlink') {
    const isArticleGeneration = type === 'article_generation';
    const subject = isArticleGeneration 
      ? 'Your Custom Article is Live! - Article Generation Complete'
      : 'Your Article is Live! - Backlink Successfully Added';
    
    const emailData = {
      from: this.fromEmail,
      to: email,
      subject,
      html: this._generateCompletionTemplate(articleData, type)
    };

    return this._sendEmailWithRetry(emailData, 'completion_notification');
  }

  /**
   * Send refund notification email
   * @param {string} email - Customer email
   * @param {Object} orderData - Order details
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Email send result
   */
  async sendRefundNotification(email, orderData, reason) {
    const emailData = {
      from: this.fromEmail,
      to: email,
      subject: `Refund Processed - Order #${orderData.id}`,
      html: this._generateRefundTemplate(orderData, reason)
    };

    return this._sendEmailWithRetry(emailData, 'refund_notification');
  }

  /**
   * Send email with retry logic
   * @param {Object} emailData - Email data for SendGrid
   * @param {string} emailType - Type of email for logging
   * @returns {Promise<Object>} Email send result
   * @private
   */
  async _sendEmailWithRetry(emailData, emailType) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Sending ${emailType} email to ${emailData.to} (attempt ${attempt}/${this.maxRetries})`);

        const result = await sgMail.send(emailData);

        console.log(`Successfully sent ${emailType} email to ${emailData.to}`, {
          messageId: result[0]?.headers['x-message-id'],
          attempt
        });

        return {
          success: true,
          messageId: result[0]?.headers['x-message-id'],
          attempt,
          type: emailType
        };

      } catch (error) {
        lastError = error;
        console.error(`Failed to send ${emailType} email to ${emailData.to} (attempt ${attempt}/${this.maxRetries}):`, {
          error: error.message,
          statusCode: error.code
        });

        // Don't retry on certain errors
        if (this._isNonRetryableError(error)) {
          break;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this._sleep(delay);
        }
      }
    }

    // All retries failed
    console.error(`Failed to send ${emailType} email to ${emailData.to} after ${this.maxRetries} attempts`);
    throw new AppError(`Failed to send ${emailType} email after ${this.maxRetries} attempts: ${lastError.message}`, 500);
  }

  /**
   * Check if error should not be retried
   * @param {Error} error - The error to check
   * @returns {boolean} True if error should not be retried
   * @private
   */
  _isNonRetryableError(error) {
    // Don't retry on authentication errors, invalid email addresses, etc.
    // SendGrid error codes: https://docs.sendgrid.com/api-reference/mail-send/errors
    const nonRetryableCodes = [400, 401, 403, 413, 413];
    return nonRetryableCodes.includes(error.code) || 
           (error.response && nonRetryableCodes.includes(error.response.statusCode));
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate magic link email template
   * @param {string} magicLinkUrl - The magic link URL
   * @param {Object} sessionData - Session data for context
   * @returns {string} HTML email template
   * @private
   */
  _generateMagicLinkTemplate(magicLinkUrl, sessionData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Purchase</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Complete Your Article Purchase</h1>
        </div>
        
        <p>Hello!</p>
        
        <p>You've initiated a purchase for ${sessionData.type === 'article_generation' ? 'a custom article generation' : 'an article backlink'}. To complete your order, please click the secure link below:</p>
        
        <div style="text-align: center;">
          <a href="${magicLinkUrl}" class="button">Complete Your Purchase</a>
        </div>
        
        <div class="warning">
          <strong>Security Notice:</strong> This link is valid for a limited time and can only be used once. If you didn't request this purchase, please ignore this email.
        </div>
        
        <p><strong>Order Details:</strong></p>
        <ul>
          ${sessionData.type === 'article_generation' ? `
            <li><strong>Article Title:</strong> ${sessionData.articleTitle || 'Custom Article'}</li>
            <li><strong>Domain:</strong> ${sessionData.domainName || 'Selected Domain'}</li>
            <li><strong>Service:</strong> Custom Article Generation</li>
            <li><strong>Price:</strong> $25.00</li>
          ` : `
            <li><strong>Article:</strong> ${sessionData.articleTitle || 'Selected Article'}</li>
            <li><strong>Keyword:</strong> ${sessionData.keyword || 'N/A'}</li>
            <li><strong>Target URL:</strong> ${sessionData.targetUrl || 'N/A'}</li>
            <li><strong>Price:</strong> $15.00</li>
          `}
        </ul>
        
        <p>After clicking the link, you'll be redirected to complete your payment securely through Stripe.</p>
        
        <div class="footer">
          <p>If you have any questions, please contact our support team.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate order confirmation email template
   * @param {Object} orderData - Order details
   * @returns {string} HTML email template
   * @private
   */
  _generateOrderConfirmationTemplate(orderData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
          .status { background: #cce5ff; padding: 10px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Order Confirmed!</h1>
        </div>
        
        <p>Thank you for your purchase! Your order has been confirmed and is now being processed.</p>
        
        <div class="order-details">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${orderData.id}</p>
          <p><strong>Article:</strong> ${orderData.articleTitle || 'Selected Article'}</p>
          <p><strong>Keyword:</strong> ${orderData.backlink_data.keyword}</p>
          <p><strong>Target URL:</strong> ${orderData.backlink_data.target_url}</p>
          <p><strong>Amount Paid:</strong> $15.00</p>
          <p><strong>Order Date:</strong> ${new Date(orderData.created_at).toLocaleDateString()}</p>
        </div>
        
        <div class="status">
          <h4>What happens next?</h4>
          <ol>
            <li><strong>Backlink Integration:</strong> We'll add your contextual backlink to the article</li>
            <li><strong>Quality Review:</strong> Our system will run quality checks on the updated content</li>
            <li><strong>Admin Review:</strong> Our team will review the article for final approval</li>
            <li><strong>Publication:</strong> Once approved, the article will be published and you'll receive a notification</li>
          </ol>
        </div>
        
        <p>The entire process typically takes 1-2 business days. You'll receive an email notification once your article is live.</p>
        
        <div class="footer">
          <p>If you have any questions about your order, please contact our support team and reference order ID: ${orderData.id}</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate completion notification email template
   * @param {Object} articleData - Published article details
   * @returns {string} HTML email template
   * @private
   */
  _generateCompletionTemplate(articleData, type = 'backlink') {
    const isArticleGeneration = type === 'article_generation';
    const articleUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/articles/${articleData.slug}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isArticleGeneration ? 'Your Custom Article is Live!' : 'Your Article is Live!'}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .article-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 ${isArticleGeneration ? 'Your Custom Article is Live!' : 'Your Article is Live!'}</h1>
        </div>
        
        <p>${isArticleGeneration ? 
          'Excellent! Your custom article has been generated, reviewed, and published on your selected domain.' : 
          'Great news! Your article has been approved and published. Your backlink is now live and ready to drive traffic to your website.'}</p>
        
        <div style="text-align: center;">
          <a href="${articleUrl}" class="button">View Your Article</a>
        </div>
        
        <div class="article-details">
          <h3>Article Details</h3>
          <p><strong>Title:</strong> ${articleData.title}</p>
          <p><strong>Published:</strong> ${new Date(articleData.published_at).toLocaleDateString()}</p>
          ${isArticleGeneration ? `
          <p><strong>Domain:</strong> ${articleData.domain?.name || 'Your Selected Domain'}</p>
          <p><strong>Word Count:</strong> ${articleData.wordCount || 'Professional length'}</p>
          <p><strong>SEO Optimized:</strong> Yes, with targeted keywords</p>
          ` : `
          <p><strong>Your Backlink:</strong></p>
          <ul>
            <li><strong>Anchor Text:</strong> ${articleData.backlinkData?.keyword || 'Your keyword'}</li>
            <li><strong>Target URL:</strong> ${articleData.backlinkData?.targetUrl || 'Your URL'}</li>
            <li><strong>Link Type:</strong> Dofollow (passes SEO value)</li>
          </ul>
          `}
        </div>
        
        <p><strong>What this means for you:</strong></p>
        <ul>
          ${isArticleGeneration ? `
          <li>Your custom article is now live and indexed by search engines</li>
          <li>The content is SEO-optimized to help drive organic traffic</li>
          <li>Professional quality content enhances your domain authority</li>
          <li>Ready for social media sharing and marketing campaigns</li>
          ` : `
          <li>Your backlink is now live and indexed by search engines</li>
          <li>The link will help improve your website's SEO authority</li>
          <li>Readers can discover your content through the contextual link</li>
          `}
        </ul>
        
        <p>Thank you for choosing our service! We hope this backlink helps drive valuable traffic to your website.</p>
        
        <div class="footer">
          <p>If you have any questions or need support, please don't hesitate to contact us.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate refund notification email template
   * @param {Object} orderData - Order details
   * @param {string} reason - Refund reason
   * @returns {string} HTML email template
   * @private
   */
  _generateRefundTemplate(orderData, reason) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refund Processed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .refund-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Refund Processed</h1>
        </div>
        
        <p>We're writing to inform you that your order has been refunded. We apologize that we couldn't complete your backlink placement as requested.</p>
        
        <div class="refund-details">
          <h3>Refund Details</h3>
          <p><strong>Order ID:</strong> ${orderData.id}</p>
          <p><strong>Refund Amount:</strong> $15.00</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Processing Time:</strong> 5-10 business days</p>
        </div>
        
        <p><strong>What happened?</strong></p>
        <p>During our quality review process, we determined that we couldn't integrate your backlink while maintaining our content quality standards. Rather than deliver subpar content, we've issued a full refund.</p>
        
        <p><strong>Next Steps:</strong></p>
        <ul>
          <li>Your refund will appear on your original payment method within 5-10 business days</li>
          <li>You're welcome to try again with a different article or modified requirements</li>
          <li>Contact our support team if you'd like assistance with future orders</li>
        </ul>
        
        <p>We appreciate your understanding and apologize for any inconvenience.</p>
        
        <div class="footer">
          <p>If you have any questions about this refund, please contact our support team and reference order ID: ${orderData.id}</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send article ready email - notify customer their article is ready for review
   * @param {string} email - Customer email
   * @param {Object} articleData - Article details
   * @returns {Promise<Object>} Email send result
   */
  async sendArticleReadyEmail(email, articleData) {
    const emailData = {
      from: this.fromEmail,
      to: email,
      subject: `Your Article is Ready for Review - Order #${articleData.orderId}`,
      html: this._generateArticleReadyTemplate(articleData)
    };

    return this._sendEmailWithRetry(emailData, 'article_ready');
  }

  /**
   * Send backlink integrated email - notify customer their backlink has been integrated
   * @param {string} email - Customer email
   * @param {Object} backlinkData - Backlink integration details
   * @returns {Promise<Object>} Email send result
   */
  async sendBacklinkIntegratedEmail(email, backlinkData) {
    const emailData = {
      from: this.fromEmail,
      to: email,
      subject: `Your Backlink is Ready for Review - Order #${backlinkData.orderId}`,
      html: this._generateBacklinkIntegratedTemplate(backlinkData)
    };

    return this._sendEmailWithRetry(emailData, 'backlink_integrated');
  }

  /**
   * Send revision ready email - notify customer their revision is ready
   * @param {string} email - Customer email
   * @param {Object} revisionData - Revision details
   * @returns {Promise<Object>} Email send result
   */
  async sendRevisionReadyEmail(email, revisionData) {
    const emailData = {
      from: this.fromEmail,
      to: email,
      subject: `Your Revision is Ready - Order #${revisionData.orderId}`,
      html: this._generateRevisionReadyTemplate(revisionData)
    };

    return this._sendEmailWithRetry(emailData, 'revision_ready');
  }

  /**
   * Send order failed email - notify customer their order processing failed
   * @param {string} email - Customer email
   * @param {Object} failureData - Failure details
   * @returns {Promise<Object>} Email send result
   */
  async sendOrderFailedEmail(email, failureData) {
    const emailData = {
      from: this.fromEmail,
      to: email,
      subject: `Order Processing Issue - Order #${failureData.orderId}`,
      html: this._generateOrderFailedTemplate(failureData)
    };

    return this._sendEmailWithRetry(emailData, 'order_failed');
  }

  /**
   * Generate article ready email template
   * @private
   */
  _generateArticleReadyTemplate(articleData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #4CAF50; padding: 20px; text-align: center; color: white; }
          .content { padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Your Article is Ready!</h1>
        </div>
        
        <div class="content">
          <p>Great news! Your article "${articleData.topic}" has been generated and is ready for your review.</p>
          
          <p><strong>What's next?</strong></p>
          <ol>
            <li>Click the button below to review your article</li>
            <li>Check if you're satisfied with the content and backlink placement</li>
            <li>If you need any changes, you can request a revision</li>
            <li>Once satisfied, submit it for final approval</li>
          </ol>
          
          <p style="text-align: center;">
            <a href="${articleData.viewUrl}" class="button">Review Your Article</a>
          </p>
          
          <p><strong>Order ID:</strong> ${articleData.orderId}</p>
          <p><strong>Article ID:</strong> ${articleData.articleId}</p>
          
          <p>You can request unlimited revisions until you're completely satisfied with the result.</p>
        </div>
        
        <div class="footer">
          <p>This link will remain active. You can return to review your article at any time.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate backlink integrated email template
   * @private
   */
  _generateBacklinkIntegratedTemplate(backlinkData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #2196F3; padding: 20px; text-align: center; color: white; }
          .content { padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Your Backlink is Ready!</h1>
        </div>
        
        <div class="content">
          <p>Great news! Your backlink has been successfully integrated into the article "${backlinkData.articleSlug}".</p>
          
          <p><strong>What's next?</strong></p>
          <ol>
            <li>Click the button below to review the updated article</li>
            <li>Check the backlink placement and integration</li>
            <li>If you need any adjustments, request a revision</li>
            <li>Once satisfied, submit for final approval and publishing</li>
          </ol>
          
          <p style="text-align: center;">
            <a href="${backlinkData.viewUrl}" class="button">Review Your Backlink</a>
          </p>
          
          <p><strong>Order ID:</strong> ${backlinkData.orderId}</p>
          <p><strong>Article ID:</strong> ${backlinkData.articleId}</p>
          
          <p>Don't worry - you can request revisions if you'd like any changes to the integration.</p>
        </div>
        
        <div class="footer">
          <p>This link will remain active. You can return to review your backlink at any time.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate revision ready email template
   * @private
   */
  _generateRevisionReadyTemplate(revisionData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #FF9800; padding: 20px; text-align: center; color: white; }
          .content { padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔄 Your Revision is Ready!</h1>
        </div>
        
        <div class="content">
          <p>We've completed the revisions you requested for "${revisionData.articleSlug}".</p>
          
          <p><strong>What's next?</strong></p>
          <ol>
            <li>Click the button below to review the updated version</li>
            <li>Check if your requested changes have been implemented</li>
            <li>Request another revision if needed (unlimited revisions available)</li>
            <li>Once satisfied, submit for final approval</li>
          </ol>
          
          <p style="text-align: center;">
            <a href="${revisionData.viewUrl}" class="button">Review Revision</a>
          </p>
          
          <p><strong>Order ID:</strong> ${revisionData.orderId}</p>
          <p><strong>Article ID:</strong> ${revisionData.articleId}</p>
          
          <p>We've carefully implemented your feedback. Take your time reviewing - you can always request more changes!</p>
        </div>
        
        <div class="footer">
          <p>This link will remain active. You can return to review your revision at any time.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate order failed email template
   * @private
   */
  _generateOrderFailedTemplate(failureData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background-color: #f44336; padding: 20px; text-align: center; color: white; }
          .content { padding: 20px; }
          .error-box { background-color: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>⚠️ Order Processing Issue</h1>
        </div>
        
        <div class="content">
          <p>We encountered an issue while processing your order and our system was unable to complete it automatically.</p>
          
          <div class="error-box">
            <p><strong>Order ID:</strong> ${failureData.orderId}</p>
            <p><strong>Issue:</strong> ${failureData.error}</p>
          </div>
          
          <p><strong>What's happening now?</strong></p>
          <p>Our team has been notified and will review your order manually. We'll work to resolve this as quickly as possible.</p>
          
          <p><strong>What should you do?</strong></p>
          <ul>
            <li>No action needed - we'll handle this for you</li>
            <li>You'll receive an email update within 24 hours</li>
            <li>If we can't complete your order, you'll receive a full refund</li>
          </ul>
          
          <p>We apologize for any inconvenience and appreciate your patience.</p>
        </div>
        
        <div class="footer">
          <p>If you have urgent questions, please contact support and reference order ID: ${failureData.orderId}</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = EmailService;