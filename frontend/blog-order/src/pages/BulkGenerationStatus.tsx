import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  generationService,
  type BulkGenerationStatusResponse,
} from "../services/generationService";

export default function BulkGenerationStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionId = searchParams.get("session_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BulkGenerationStatusResponse | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session ID");
      setLoading(false);
      return;
    }

    fetchStatus();
    // Poll every 10 seconds for updates
    const interval = setInterval(fetchStatus, 10000);

    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchStatus = async () => {
    try {
      const response = await generationService.getBulkGenerationStatus(
        sessionId!
      );
      setData(response);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching status:", err);
      setError(
        err.response?.data?.error || "Failed to fetch generation status"
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { bg: string; text: string; icon: string }
    > = {
      PROCESSING: { bg: "bg-blue-100", text: "text-blue-800", icon: "⏳" },
      QUALITY_CHECK: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        icon: "🔍",
      },
      ADMIN_REVIEW: {
        bg: "bg-purple-100",
        text: "text-purple-800",
        icon: "👀",
      },
      COMPLETED: { bg: "bg-green-100", text: "text-green-800", icon: "✅" },
      FAILED: { bg: "bg-red-100", text: "text-red-800", icon: "❌" },
    };

    const config = statusConfig[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      icon: "⚪",
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}
      >
        <span>{config.icon}</span>
        {status.replace(/_/g, " ")}
      </span>
    );
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Invalid Request
          </h2>
          <p className="text-gray-600 mb-6">
            Missing session ID. Please check your email for the correct link.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <svg
            className="animate-spin h-12 w-12 text-green-600 mx-auto mb-4"
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
          <p className="text-gray-600">Loading generation status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Error Loading Status
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchStatus}
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
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { session, orders } = data;

  // Group orders by domain
  const ordersByDomain = orders.reduce((acc, order) => {
    const domainName = order.article?.domain.name || "Unknown Domain";
    if (!acc[domainName]) {
      acc[domainName] = [];
    }
    acc[domainName].push(order);
    return acc;
  }, {} as Record<string, typeof orders>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
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
            Back to Homepage
          </button>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📊 Article Generation Status
          </h1>
          <p className="text-gray-600">
            Track your bulk article generation progress
          </p>
        </div>

        {/* Session Info */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Email</p>
              <p className="font-semibold text-gray-800">{session.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Articles</p>
              <p className="font-semibold text-gray-800">{orders.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Session Status</p>
              {getStatusBadge(session.status)}
            </div>
          </div>
        </div>

        {/* Orders by Domain */}
        <div className="space-y-6">
          {Object.entries(ordersByDomain).map(([domainName, domainOrders]) => (
            <div
              key={domainName}
              className="bg-white rounded-xl shadow-md overflow-hidden"
            >
              {/* Domain Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
                <h3 className="font-bold text-lg">{domainName}</h3>
                <p className="text-green-100 text-sm">
                  {domainOrders.length} article
                  {domainOrders.length !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Domain Orders */}
              <div className="p-6 space-y-4">
                {domainOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Order Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 mb-1">
                          {order.backlink_data.topic}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Order ID: {order.id}
                        </p>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    {/* Order Details */}
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        {order.backlink_data.niche && (
                          <p className="text-gray-600">
                            <span className="font-medium">Niche:</span>{" "}
                            {order.backlink_data.niche}
                          </p>
                        )}
                        {order.backlink_data.keyword && (
                          <p className="text-gray-600">
                            <span className="font-medium">Keyword:</span>{" "}
                            {order.backlink_data.keyword}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-gray-600">
                          <span className="font-medium">Backlink:</span>{" "}
                          <a
                            href={order.backlink_data.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:underline"
                          >
                            {order.backlink_data.anchorText}
                          </a>
                        </p>
                      </div>
                    </div>

                    {/* Article Info (if available) */}
                    {order.article && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">
                              Article:{" "}
                              {order.article.selected_version?.title ||
                                "Untitled"}
                            </p>
                            {order.article.selected_version && (
                              <p className="text-xs text-gray-500">
                                QC Status:{" "}
                                {order.article.selected_version
                                  .last_qc_status || "N/A"}
                              </p>
                            )}
                          </div>
                          {order.status === "COMPLETED" && (
                            <a
                              href={`/${order.article.domain.slug}/${order.article.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-green-600 hover:underline font-medium"
                            >
                              View Article →
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-500">
                      <span>
                        Created: {new Date(order.created_at).toLocaleString()}
                      </span>
                      {order.completed_at && (
                        <span>
                          Completed:{" "}
                          {new Date(order.completed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Refresh Notice */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-sm text-blue-800">
            🔄 This page auto-refreshes every 10 seconds to show the latest
            status
          </p>
        </div>
      </div>
    </div>
  );
}
