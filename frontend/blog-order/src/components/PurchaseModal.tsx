import { useState } from 'react';
import { X, ShoppingCart, Mail, ExternalLink, AlertCircle } from 'lucide-react';
import type { PublicArticle } from '../types/purchase';
import { initiatePurchase } from '../services/purchaseService';

interface PurchaseModalProps {
  article: PublicArticle;
  onClose: () => void;
  onComplete: () => void;
}

export default function PurchaseModal({ article, onClose, onComplete }: PurchaseModalProps) {
  const [formData, setFormData] = useState({
    keyword: '',
    targetUrl: '',
    notes: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'email-sent'>('form');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.keyword.trim()) {
      setError('Keyword/anchor text is required');
      return false;
    }
    if (!formData.targetUrl.trim()) {
      setError('Target URL is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }

    // Basic URL validation
    try {
      new URL(formData.targetUrl);
    } catch {
      setError('Please enter a valid URL (including http:// or https://)');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      const purchaseRequest = {
        articleId: article.id,
        keyword: formData.keyword.trim(),
        targetUrl: formData.targetUrl.trim(),
        notes: formData.notes.trim() || undefined,
        email: formData.email.trim()
      };

      const result = await initiatePurchase(purchaseRequest);
      
      if (result.magicLinkSent) {
        setStep('email-sent');
      } else {
        setError('Failed to send magic link. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate purchase');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSentClose = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            {step === 'form' ? 'Purchase Backlink' : 'Check Your Email'}
          </h2>
          <button
            onClick={step === 'email-sent' ? handleEmailSentClose : onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {step === 'form' ? (
          <>
            {/* Article Info */}
            <div className="p-4 sm:p-6 bg-gray-50 border-b">
              <h3 className="font-medium text-gray-900 mb-2">{article.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{article.preview}</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-lg font-semibold text-blue-600">$15.00</span>
                <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center sm:justify-start">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Preview Article
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 sm:p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Keyword/Anchor Text */}
                <div>
                  <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 mb-1">
                    Keyword/Anchor Text *
                  </label>
                  <input
                    type="text"
                    id="keyword"
                    name="keyword"
                    value={formData.keyword}
                    onChange={handleInputChange}
                    placeholder="e.g., best SEO tools"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This text will be used as the clickable anchor text for your backlink
                  </p>
                </div>

                {/* Target URL */}
                <div>
                  <label htmlFor="targetUrl" className="block text-sm font-medium text-gray-700 mb-1">
                    Target URL *
                  </label>
                  <input
                    type="url"
                    id="targetUrl"
                    name="targetUrl"
                    value={formData.targetUrl}
                    onChange={handleInputChange}
                    placeholder="https://example.com/your-page"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The URL where your backlink should point to
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send you a secure link to complete your purchase
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Any specific requirements or context for the backlink placement..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center order-1 sm:order-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Continue to Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Email Sent Step */
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Check Your Email
            </h3>
            <p className="text-gray-600 mb-6">
              We've sent a secure link to <strong>{formData.email}</strong>. 
              Click the link in your email to complete your purchase.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Next steps:</strong>
                <br />
                1. Check your email (including spam folder)
                <br />
                2. Click the secure link to authenticate
                <br />
                3. Complete payment via Stripe ($15.00)
                <br />
                4. We'll integrate your backlink and notify you when complete
              </p>
            </div>
            <button
              onClick={handleEmailSentClose}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}