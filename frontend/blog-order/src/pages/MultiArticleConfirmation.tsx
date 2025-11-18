import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function MultiArticleConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get("session_id");
  const email = searchParams.get("email");
  const count = searchParams.get("count") || "1";

  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [navigate]);

  if (!sessionId || !email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Invalid Request
          </h2>
          <p className="text-gray-600 mb-6">
            Missing session information. Please try again.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl w-full">
        {/* Success Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 rounded-full mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12 text-purple-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Check Your Email! 📧
          </h1>
          <p className="text-gray-600">We've sent a secure magic link to:</p>
          <p className="text-lg font-semibold text-purple-600 mt-2">{email}</p>
        </div>

        {/* Order Summary */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-800">Articles Requested</p>
              <p className="text-2xl font-bold text-purple-900">{count}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-800">Total Price</p>
              <p className="text-2xl font-bold text-purple-900">
                ${(parseInt(count) * 25).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="font-bold text-green-800 mb-3 flex items-center gap-2">
            <span className="text-xl">📝</span>
            Next Steps:
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>
              <span className="font-medium">Check your inbox</span> for an email
              from us
            </li>
            <li>
              <span className="font-medium">Click the magic link</span> to
              verify your email
            </li>
            <li>
              <span className="font-medium">Complete payment</span> via secure
              Stripe checkout
            </li>
            <li>
              <span className="font-medium">Track your articles</span> as our AI
              generates them
            </li>
          </ol>
        </div>

        {/* Session Info */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">Your Session ID:</p>
          <p className="font-mono text-sm bg-white px-3 py-2 rounded border border-gray-200 break-all">
            {sessionId}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Save this ID for reference if you need support
          </p>
        </div>

        {/* Important Notes */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            Important:
          </h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• The magic link expires in 24 hours</li>
            <li>• Check your spam folder if you don't see the email</li>
            <li>• All {count} articles will be for the same domain</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Back to Homepage ({countdown}s)
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            Didn't Receive Email?
          </button>
        </div>

        {/* FAQ Link */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Need help?{" "}
            <a
              href="mailto:support@example.com"
              className="text-purple-600 hover:underline font-medium"
            >
              Contact Support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
