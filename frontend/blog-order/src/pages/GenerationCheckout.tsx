import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGenerationCart } from "../contexts/GenerationCartContext";
import { generationService } from "../services/generationService";

export default function GenerationCheckout() {
  const navigate = useNavigate();
  const { requests, clearCart } = useGenerationCart();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPrice = requests.length * 25;

  // Group requests by domain for display
  const requestsByDomain = requests.reduce((acc, req) => {
    if (!acc[req.domainId]) {
      acc[req.domainId] = {
        domainName: req.domainName,
        domainSlug: req.domainSlug,
        requests: [],
      };
    }
    acc[req.domainId].requests.push(req);
    return acc;
  }, {} as Record<string, { domainName: string; domainSlug: string; requests: typeof requests }>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (requests.length === 0) {
      setError("Your cart is empty");
      return;
    }

    setIsSubmitting(true);

    try {
      // Transform requests to backend format
      const generationRequests = requests.map((req) => ({
        domainId: req.domainId,
        topic: req.topic,
        niche: req.niche,
        keyword: req.keyword,
        targetUrl: req.targetUrl,
        anchorText: req.anchorText,
        notes: req.notes,
      }));

      const response = await generationService.initiateBulkGeneration(
        generationRequests,
        email.trim()
      );

      // Clear cart on success
      clearCart();

      // Navigate to confirmation page
      navigate(
        `/generation-confirmation?session_id=${
          response.sessionId
        }&email=${encodeURIComponent(email)}`
      );
    } catch (err: any) {
      console.error("Error initiating generation:", err);
      setError(
        err.response?.data?.error ||
          "Failed to initiate article generation. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (requests.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Your Cart is Empty
          </h2>
          <p className="text-gray-600 mb-6">
            Add articles to your cart to request generation
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Browse Domains
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium mb-4"
          >
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
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            Back
          </button>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎨 Article Generation Checkout
          </h1>
          <p className="text-gray-600">
            Review your requests and complete your order
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Left Column - Order Summary */}
          <div className="md:col-span-2 space-y-6">
            {/* Requests by Domain */}
            {Object.entries(requestsByDomain).map(([domainId, data]) => (
              <div
                key={domainId}
                className="bg-white rounded-xl shadow-md overflow-hidden"
              >
                <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
                  <h3 className="font-bold text-lg">{data.domainName}</h3>
                  <p className="text-green-100 text-sm">
                    {data.requests.length} article
                    {data.requests.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="p-4 space-y-4">
                  {data.requests.map((req, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <h4 className="font-semibold text-gray-800 mb-2">
                        {req.topic}
                      </h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        {req.niche && (
                          <p>
                            <span className="font-medium">Niche:</span>{" "}
                            {req.niche}
                          </p>
                        )}
                        {req.keyword && (
                          <p>
                            <span className="font-medium">Keyword:</span>{" "}
                            {req.keyword}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Backlink URL:</span>{" "}
                          <a
                            href={req.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:underline"
                          >
                            {req.targetUrl}
                          </a>
                        </p>
                        <p>
                          <span className="font-medium">Anchor Text:</span>{" "}
                          {req.anchorText}
                        </p>
                        {req.notes && (
                          <p>
                            <span className="font-medium">Notes:</span>{" "}
                            {req.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right Column - Email & Payment */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Order Summary
              </h2>

              {/* Price Breakdown */}
              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>
                    Articles ({requests.length}){" "}
                    <span className="text-sm">× $25.00</span>
                  </span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-800">
                  <span>Total</span>
                  <span className="text-green-600">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Your Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send a secure payment link to this email
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
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
                      Processing...
                    </span>
                  ) : (
                    "Continue to Payment"
                  )}
                </button>
              </form>

              {/* Info Box */}
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-gray-700">
                <h4 className="font-semibold text-green-800 mb-2">
                  What happens next?
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>We'll send a secure magic link to your email</li>
                  <li>Click the link to proceed to payment</li>
                  <li>Our AI generates your articles with backlinks</li>
                  <li>Review and approve before publication</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
