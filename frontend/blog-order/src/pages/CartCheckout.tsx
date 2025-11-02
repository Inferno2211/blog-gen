import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { initiateBulkPurchase } from "../services/purchaseService";

export default function CartCheckout() {
  const { items, totalPrice, totalItems, clearCart } = useCart();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Redirect to homepage if cart is empty
    if (items.length === 0) {
      navigate("/purchase");
    }
  }, [items.length, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Please enter a valid email address");
      }

      // Prepare cart items for API
      const cartItems = items.map((item) => ({
        articleId: item.article.id,
        backlinkData: {
          keyword: item.backlinkData.keyword,
          targetUrl: item.backlinkData.targetUrl,
          notes: item.backlinkData.notes,
        },
      }));

      // Initiate bulk purchase
      const response = await initiateBulkPurchase({
        cartItems,
        email,
      });

      // Clear cart after successful submission
      clearCart();

      // Show success message
      alert(
        `Magic link sent to ${email}!\n\n` +
          `We've sent a verification link to your email. ` +
          `Click the link to complete your purchase of ${
            response.articleCount
          } backlink${response.articleCount > 1 ? "s" : ""}.`
      );

      // Redirect to homepage
      navigate("/purchase");
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err.message || "Failed to process checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/purchase")}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
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
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to Articles
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Checkout</h1>
          <p className="text-gray-600 mt-2">
            Review your order and complete your purchase
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Order Summary ({totalItems}{" "}
                {totalItems === 1 ? "item" : "items"})
              </h2>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {items.map((item, index) => (
                  <div
                    key={item.article.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <span className="text-xs text-gray-500">
                          #{index + 1}
                        </span>
                        <h3 className="font-semibold text-gray-800">
                          {item.article.title}
                        </h3>
                      </div>
                      <span className="font-bold text-blue-600">$15.00</span>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">Domain:</span>{" "}
                        {item.article.domain}
                      </p>
                      <p>
                        <span className="font-medium">Keyword:</span> "
                        {item.backlinkData.keyword}"
                      </p>
                      <p className="break-all">
                        <span className="font-medium">URL:</span>{" "}
                        {item.backlinkData.targetUrl}
                      </p>
                      {item.backlinkData.notes && (
                        <p className="text-xs text-gray-500 italic mt-2">
                          Note: {item.backlinkData.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Payment Details
              </h2>

              {/* Pricing */}
              <div className="border-b border-gray-200 pb-4 mb-4">
                <div className="flex justify-between text-gray-600 mb-2">
                  <span>{totalItems} × $15.00</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-800">
                  <span>Total:</span>
                  <span className="text-blue-600">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll send a magic link to verify your email and complete
                    payment
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
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
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
                    `Send Magic Link & Pay $${totalPrice.toFixed(2)}`
                  )}
                </button>

                <div className="text-xs text-gray-500 text-center">
                  <p>🔒 Secure checkout via Stripe</p>
                  <p className="mt-1">
                    You'll be redirected to payment after email verification
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
