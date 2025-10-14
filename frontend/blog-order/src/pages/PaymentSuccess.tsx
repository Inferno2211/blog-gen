import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, Home } from "lucide-react";
import { completePurchase, getOrderDetails } from "../services/purchaseService";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const stripeSessionId = searchParams.get("stripe_session_id"); // This is the Stripe session ID
    const sessionId = searchParams.get("session_id"); // This is our internal purchase session ID

    if (!stripeSessionId || !sessionId) {
      setError("Invalid payment confirmation link");
      setLoading(false);
      return;
    }

    handlePaymentCompletion(sessionId, stripeSessionId);
  }, [searchParams]);

  const handlePaymentCompletion = async (
    sessionId: string,
    stripeSessionId: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await completePurchase(sessionId, stripeSessionId);

      if (response.success && response.data.orderId) {
        setOrderId(response.data.orderId);
        // Automatically redirect to appropriate configuration after 3 seconds
        setTimeout(async () => {
          try {
            const orderData = await getOrderDetails(response.data.orderId);
            console.log('Order data for redirect:', orderData); // Debug log
            const isArticleGeneration = orderData.order?.backlinkData?.type === 'ARTICLE_GENERATION';
            console.log('Is article generation?', isArticleGeneration, orderData.order?.backlinkData); // Debug log
            
            if (isArticleGeneration) {
              console.log('Redirecting to article configuration'); // Debug log
              navigate(`/configure-article?order_id=${response.data.orderId}`);
            } else {
              console.log('Redirecting to backlink configuration'); // Debug log
              const sessionId = searchParams.get("session_id");
              navigate(`/configure-backlink?session_id=${sessionId}&order_id=${response.data.orderId}`);
            }
          } catch (error) {
            console.error('Failed to get order type for redirect:', error);
            console.error('Error details:', error.message, error.stack);
            // Better fallback - try to determine from URL or default to home
            console.log('Falling back to home page due to error');
            navigate("/");
          }
        }, 3000);
      } else {
        setError("Failed to complete order");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment completion failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinueToConfiguration = async () => {
    if (orderId) {
      const sessionId = searchParams.get("session_id");
      
      try {
        // Get order details to determine the type
        const orderData = await getOrderDetails(orderId);
        console.log('Manual continue - Order data:', orderData); // Debug log
        const isArticleGeneration = orderData.order?.backlinkData?.type === 'ARTICLE_GENERATION';
        console.log('Manual continue - Is article generation?', isArticleGeneration); // Debug log
        
        if (isArticleGeneration) {
          navigate(`/configure-article?order_id=${orderId}`);
        } else {
          navigate(`/configure-backlink?session_id=${sessionId}&order_id=${orderId}`);
        }
      } catch (error) {
        console.error('Failed to get order type:', error);
        console.error('Manual continue error details:', error.message);
        // Better fallback - go to home instead of potentially broken backlink page
        navigate("/");
      }
    }
  };

  const handleReturnHome = () => {
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Completing your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
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

  if (orderId) {
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
              Your payment has been processed successfully. You will now be
              redirected to configure your order.
            </p>

            {/* Auto-redirect message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
              <p className="text-blue-800 text-sm">
                Redirecting to configuration in a few seconds...
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleContinueToConfiguration}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Configure Order Now
              </button>
              <button
                onClick={handleReturnHome}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Return to Homepage
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
