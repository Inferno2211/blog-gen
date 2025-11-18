import { useNavigate } from "react-router-dom";
import { useGenerationCart } from "../contexts/GenerationCartContext";

export default function GenerationCart() {
  const {
    requests,
    removeFromCart,
    clearCart,
    totalRequests,
    totalPrice,
    isCartOpen,
    closeCart,
  } = useGenerationCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (requests.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    closeCart();
    navigate("/generation-checkout");
  };

  if (!isCartOpen) return null;

  // Group requests by domain
  const requestsByDomain = requests.reduce((acc, request, index) => {
    const domainKey = request.domainId;
    if (!acc[domainKey]) {
      acc[domainKey] = {
        domainName: request.domainName,
        domainSlug: request.domainSlug,
        requests: [],
      };
    }
    acc[domainKey].requests.push({ ...request, index });
    return acc;
  }, {} as Record<string, { domainName: string; domainSlug: string; requests: any[] }>);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-green-50">
          <h2 className="text-xl font-bold text-green-800">
            🎨 Article Generation Cart ({totalRequests})
          </h2>
          <button
            onClick={closeCart}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close cart"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {requests.length === 0 ? (
            <div className="text-center py-12">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-16 h-16 mx-auto text-gray-300 mb-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
                />
              </svg>
              <p className="text-gray-500 font-medium">
                Your generation cart is empty
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Browse domains and request article generation to get started
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(requestsByDomain).map(
                ([domainId, domainGroup]) => (
                  <div
                    key={domainId}
                    className="border border-green-200 rounded-lg p-3 bg-green-50"
                  >
                    {/* Domain Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-green-200">
                      <div className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5 text-green-600"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                          />
                        </svg>
                        <h3 className="font-semibold text-green-800">
                          {domainGroup.domainName}
                        </h3>
                      </div>
                      <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
                        {domainGroup.requests.length} article
                        {domainGroup.requests.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Articles for this domain */}
                    <div className="space-y-3">
                      {domainGroup.requests.map((req: any) => (
                        <div
                          key={req.index}
                          className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-800 flex-1 pr-2 text-sm">
                              📝 {req.topic}
                            </h4>
                            <button
                              onClick={() => removeFromCart(req.index)}
                              className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                              title="Remove from cart"
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
                                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                />
                              </svg>
                            </button>
                          </div>

                          <div className="space-y-1 text-xs text-gray-600">
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
                              <span className="font-medium">Backlink:</span>{" "}
                              <a
                                href={req.targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {req.anchorText}
                              </a>
                            </p>
                            {req.notes && (
                              <p className="text-gray-500 italic">
                                "{req.notes}"
                              </p>
                            )}
                          </div>

                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-green-600">
                              $25.00
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {requests.length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">Total Articles:</span>
                <span className="font-bold text-gray-900">{totalRequests}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">Total Price:</span>
                <span className="text-2xl font-bold text-green-600">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                $25 per article generation
              </p>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md"
            >
              Proceed to Checkout →
            </button>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to clear all articles from your cart?"
                  )
                ) {
                  clearCart();
                }
              }}
              className="w-full mt-2 text-red-600 hover:text-red-700 text-sm font-medium"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
