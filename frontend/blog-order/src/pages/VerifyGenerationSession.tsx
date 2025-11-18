import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { generationService } from "../services/generationService";

export default function VerifyGenerationSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const [status, setStatus] = useState<
    "verifying" | "success" | "error" | "expired"
  >("verifying");
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid verification link - missing token");
      return;
    }

    verifySession();
  }, [token]);

  const verifySession = async () => {
    try {
      setStatus("verifying");
      const response = await generationService.verifyAndPay(token!);

      // If session already paid, redirect to bulk status page
      if ((response as any).alreadyPaid) {
        const sid =
          (response as any).sessionId || (response as any).session?.id || "";
        navigate(
          `/bulk-generation-status?session_id=${encodeURIComponent(sid)}`
        );
        return;
      }

      setSessionData(response);
      setStatus("success");

      // Redirect to Stripe checkout after 2 seconds
      setTimeout(() => {
        window.location.href = response.checkoutUrl;
      }, 2000);
    } catch (err: any) {
      console.error("Verification error:", err);

      if (err.response?.status === 410) {
        setStatus("expired");
        setError("This magic link has expired. Please start a new order.");
      } else {
        setStatus("error");
        setError(
          err.response?.data?.error ||
            "Failed to verify session. Please try again."
        );
      }
    }
  };

  const renderContent = () => {
    switch (status) {
      case "verifying":
        return (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <svg
                className="animate-spin h-10 w-10 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Verifying Your Session...
            </h2>
            <p className="text-gray-600">
              Please wait while we verify your magic link
            </p>
          </div>
        );

      case "success":
        return (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-green-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Verification Successful! ✓
            </h2>
            <p className="text-gray-600 mb-4">
              Redirecting you to secure payment...
            </p>

            {sessionData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Articles:</span>{" "}
                  {sessionData.articleCount}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Total:</span> $
                  {sessionData.totalPrice.toFixed(2)}
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Opening Stripe Checkout...
            </div>
          </div>
        );

      case "expired":
        return (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 rounded-full mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-orange-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Link Expired ⏱️
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Start New Order
            </button>
          </div>
        );

      case "error":
        return (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-red-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Verification Failed
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={verifySession}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        {renderContent()}
      </div>
    </div>
  );
}
