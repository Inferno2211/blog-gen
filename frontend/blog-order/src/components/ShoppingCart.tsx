import { useNavigate } from "react-router-dom";
import { useCart } from "../contexts/CartContext";

export default function ShoppingCart() {
  const {
    items,
    removeFromCart,
    clearCart,
    totalItems,
    totalPrice,
    isCartOpen,
    closeCart,
  } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (items.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    closeCart();
    navigate("/cart-checkout");
  };

  if (!isCartOpen) return null;

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
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            Shopping Cart ({totalItems})
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
          {items.length === 0 ? (
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
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                />
              </svg>
              <p className="text-gray-500">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-2">
                Browse articles and add backlinks to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.article.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-800 flex-1 pr-2">
                      {item.article.title}
                    </h3>
                    <button
                      onClick={() => removeFromCart(item.article.id)}
                      className="text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                      aria-label="Remove from cart"
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

                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium">Domain:</span>{" "}
                      {item.article.domain}
                    </p>
                    <p>
                      <span className="font-medium">Keyword:</span> "
                      {item.backlinkData.keyword}"
                    </p>
                    <p className="truncate">
                      <span className="font-medium">URL:</span>{" "}
                      {item.backlinkData.targetUrl}
                    </p>
                    {item.backlinkData.notes && (
                      <p className="text-xs text-gray-500 italic">
                        Note: {item.backlinkData.notes}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-right font-bold text-blue-600">$15.00</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-800">
                Total:
              </span>
              <span className="text-2xl font-bold text-blue-600">
                ${totalPrice.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleCheckout}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Proceed to Checkout
              </button>
              <button
                onClick={() => {
                  if (
                    window.confirm("Are you sure you want to clear your cart?")
                  ) {
                    clearCart();
                  }
                }}
                className="w-full bg-white text-gray-700 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Clear Cart
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-3">
              Max {20 - items.length} more article
              {20 - items.length !== 1 ? "s" : ""} can be added
            </p>
          </div>
        )}
      </div>
    </>
  );
}
