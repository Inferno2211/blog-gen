import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';
import { completePurchase } from '../services/purchaseService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderCompleted, setOrderCompleted] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const stripeSessionId = searchParams.get('stripe_session_id');
    
    if (!sessionId || !stripeSessionId) {
      setError('Invalid payment confirmation link');
      setLoading(false);
      return;
    }

    handlePaymentCompletion(sessionId, stripeSessionId);
  }, [searchParams]);

  const handlePaymentCompletion = async (sessionId: string, stripeSessionId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await completePurchase(sessionId, stripeSessionId);
      
      if (result.orderId) {
        setOrderCompleted(true);
      } else {
        setError('Failed to complete order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment completion failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReturnHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Completing your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <ErrorMessage message={error} />
          <div className="text-center mt-6">
            <button
              onClick={handleReturnHome}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (orderCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>

            {/* Success Message */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Payment Successful!
            </h1>
            <p className="text-gray-600 mb-8">
              Thank you for your purchase. Your backlink order has been received and is now being processed.
            </p>

            {/* Process Steps */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="text-lg font-semibold text-blue-900 mb-4">What happens next?</h2>
              <div className="space-y-3 text-left">
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="text-blue-800 font-medium">Backlink Integration</p>
                    <p className="text-blue-700 text-sm">We'll integrate your backlink into the article contextually</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="text-blue-800 font-medium">Quality Review</p>
                    <p className="text-blue-700 text-sm">Our team will review the article for quality and compliance</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="text-blue-800 font-medium">Publication & Notification</p>
                    <p className="text-blue-700 text-sm">Once approved, we'll publish the article and notify you via email</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-gray-50 rounded-lg p-4 mb-8">
              <p className="text-sm text-gray-600">
                <strong>Estimated completion time:</strong> 1-3 business days
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleReturnHome}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Browse More Articles
              </button>
              <button
                onClick={() => window.open('mailto:support@example.com', '_blank')}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Contact Support
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}