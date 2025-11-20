import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getBulkOrderStatus } from "../services/purchaseService";
import type { BulkOrderStatusResponse } from "../services/purchaseService";

export default function BulkOrderStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");

  const [data, setData] = useState<BulkOrderStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided");
      setIsLoading(false);
      return;
    }

    const fetchStatus = async () => {
      try {
        const response = await getBulkOrderStatus(sessionId);
        setData(response);
        setError("");
      } catch (err: any) {
        console.error("Failed to fetch bulk order status:", err);
        setError(err.message || "Failed to load order status");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    // Auto-refresh every 10 seconds if enabled and there are pending orders
    let interval: number | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchStatus();
      }, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionId, autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "text-green-600 bg-green-50";
      case "PROCESSING":
      case "QUALITY_CHECK":
        return "text-blue-600 bg-blue-50";
      case "ADMIN_REVIEW":
        return "text-yellow-600 bg-yellow-50";
      case "FAILED":
      case "REFUNDED":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "✅";
      case "PROCESSING":
        return "⏳";
      case "QUALITY_CHECK":
        return "🔍";
      case "ADMIN_REVIEW":
        return "👀";
      case "FAILED":
        return "❌";
      default:
        return "📝";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">
            {error || "Failed to load order status"}
          </p>
          <button
            onClick={() => navigate("/purchase")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Articles
          </button>
        </div>
      </div>
    );
  }

  // Defensive checks - ensure all required data exists
  if (!data.session || !data.orders || !data.statistics) {
    console.error("Invalid data structure:", data);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Invalid Data
          </h2>
          <p className="text-gray-600 mb-6">
            The server returned incomplete data. Please try again or contact
            support.
          </p>
          <div className="text-left bg-gray-100 p-4 rounded mb-4 text-xs font-mono overflow-auto max-h-40">
            {JSON.stringify(data, null, 2)}
          </div>
          <button
            onClick={() => navigate("/purchase")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Articles
          </button>
        </div>
      </div>
    );
  }

  const { session, orders, statistics } = data;
  const hasActiveOrders =
    (statistics.processing || 0) > 0 ||
    (statistics.quality_check || 0) > 0 ||
    (statistics.admin_review || 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
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
          <h1 className="text-3xl font-bold text-gray-800">
            Bulk Order Status
          </h1>
          <p className="text-gray-600 mt-2">
            Track the progress of all your backlink orders
          </p>
        </div>

        {/* Statistics Overview */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Order Overview
            </h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto-refresh
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-800">
                {statistics.total || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Orders</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {statistics.processing || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Processing</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {statistics.quality_check || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Quality Check</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">
                {statistics.admin_review || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Admin Review</div>
            </div>
            {statistics.scheduled !== undefined && statistics.scheduled > 0 && (
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">
                  {statistics.scheduled}
                </div>
                <div className="text-sm text-gray-600 mt-1">Scheduled</div>
              </div>
            )}
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {statistics.completed || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Completed</div>
            </div>
          </div>

          {hasActiveOrders && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                ⏳ Your orders are being processed. This page will auto-refresh
                every 10 seconds.
              </p>
            </div>
          )}
        </div>

        {/* Order List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">All Orders</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {orders.map((order, index) => (
              <div
                key={order.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">
                        #{index + 1}
                      </span>
                      <h3 className="font-semibold text-gray-800">
                        {order.article?.title || "Article"}
                      </h3>
                    </div>
                    {order.article?.domain && (
                      <p className="text-sm text-gray-600">
                        Domain: {order.article.domain}
                      </p>
                    )}
                    {order.backlink_data && (
                      <p className="text-sm text-gray-600">
                        Keyword: "{order.backlink_data.keyword}"
                      </p>
                    )}
                  </div>

                  <div
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {getStatusIcon(order.status)}{" "}
                    {order.status.replace(/_/g, " ")}
                  </div>
                </div>

                {/* Schedule Information */}
                {order.scheduled_publish_at && (
                  <div className="mt-2 mb-2">
                    {order.scheduled_status === "SCHEDULED" && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <span className="text-blue-600">⏰</span>
                        <span className="text-blue-800">
                          <strong>Scheduled:</strong>{" "}
                          {new Date(
                            order.scheduled_publish_at
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {order.scheduled_status === "PUBLISHED" && (
                      <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm">
                        <span className="text-green-600">✅</span>
                        <span className="text-green-800">
                          Published on schedule
                        </span>
                      </div>
                    )}
                    {order.scheduled_status === "CANCELLED" && (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                        <span className="text-gray-600">⚠️</span>
                        <span className="text-gray-800">
                          Schedule cancelled (was scheduled for{" "}
                          {new Date(
                            order.scheduled_publish_at
                          ).toLocaleString()}
                          )
                        </span>
                      </div>
                    )}
                    {order.scheduled_status === "FAILED" && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-sm">
                        <span className="text-red-600">❌</span>
                        <span className="text-red-800">
                          Scheduled publish failed
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Order ID: {order.id.slice(0, 8)}...</span>
                  {order.status === "COMPLETED" && order.completed_at && (
                    <span>
                      Completed: {new Date(order.completed_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-3 flex gap-2">
                  {(order.status === "QUALITY_CHECK" ||
                    order.status === "ADMIN_REVIEW") && (
                    <button
                      onClick={() =>
                        navigate(`/order-status?order_id=${order.id}`)
                      }
                      className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Details
                    </button>
                  )}
                  {order.status === "COMPLETED" && (
                    <button className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                      View Live Article
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Session ID: {session.id}</p>
          <p>Created: {new Date(session.created_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
