import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { verifySession } from "../services/purchaseService";

export default function VerifySession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("Invalid verification link");
      setLoading(false);
      return;
    }

    handleVerification(token);
  }, [searchParams]);

  const handleVerification = async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      const result = await verifySession(token);

      if (result.valid && result.sessionData) {
        // Check if this session already has payment completed
        if (result.alreadyPaid) {
          // Session is already paid, redirect to appropriate configuration
          const isArticleGeneration =
            result.orderType === "article_generation" ||
            result.sessionData.backlink_data?.type === "ARTICLE_GENERATION";
          const orderId = result.orderId || "pending";

          if (isArticleGeneration) {
            navigate(`/configure-article?order_id=${orderId}`);
          } else {
            navigate(
              `/configure-backlink?session_id=${result.sessionData.sessionId}&order_id=${orderId}`
            );
          }
        } else if (result.stripeCheckoutUrl) {
          // Session is pending payment, redirect to Stripe checkout
          window.location.href = result.stripeCheckoutUrl;
        } else {
          // Need to complete payment first
          setError(
            "Please complete your payment first. You should receive a payment link via email after verification."
          );
        }
      } else {
        setError(result.error || "Invalid or expired verification link");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
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
          <p className="mt-4 text-gray-600">Verifying your session...</p>
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

  return null;
}
