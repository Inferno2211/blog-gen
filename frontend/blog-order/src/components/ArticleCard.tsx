import { useState, useEffect } from "react";
import {
  Calendar,
  ExternalLink,
  ShoppingCart,
  AlertCircle,
} from "lucide-react";
import type { PublicArticle } from "../types/purchase";
import { getArticleAvailability } from "../services/purchaseService";

interface ArticleCardProps {
  article: PublicArticle;
  onPurchaseClick: (article: PublicArticle) => void;
  onPreviewClick: (article: PublicArticle) => void;
}

export default function ArticleCard({
  article,
  onPurchaseClick,
  onPreviewClick,
}: ArticleCardProps) {
  const [availability, setAvailability] = useState<
    "AVAILABLE" | "SOLD_OUT" | "PROCESSING" | "LOADING"
  >(article.availability_status || "LOADING");
  const [availabilityReason, setAvailabilityReason] = useState<string>("");

  useEffect(() => {
    // Use the availability status from the article data first
    if (article.availability_status) {
      setAvailability(article.availability_status);
    } else {
      checkAvailability();
    }
  }, [article.id, article.availability_status]);

  const checkAvailability = async () => {
    try {
      const result = await getArticleAvailability(article.id);
      if (result.available) {
        setAvailability("AVAILABLE");
      } else {
        setAvailability("SOLD_OUT");
        setAvailabilityReason(result.reason || "Currently unavailable");
      }
    } catch (error) {
      console.error("Failed to check availability:", error);
      setAvailability("AVAILABLE"); // Default to available if check fails
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getAvailabilityBadge = () => {
    switch (availability) {
      case "LOADING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Checking...
          </span>
        );
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Available
          </span>
        );
      case "SOLD_OUT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Sold Out
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Processing
          </span>
        );
      default:
        return null;
    }
  };

  const isAvailable = availability === "AVAILABLE";
  const isLoading = availability === "LOADING";

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
            {article.title}
          </h3>
          <div className="flex-shrink-0">{getAvailabilityBadge()}</div>
        </div>

        {/* Article Preview */}
        <p className="text-gray-600 text-sm line-clamp-3 mb-4">
          {article.preview}
        </p>

        {/* Domain Information */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center mb-2">
            <ExternalLink className="w-4 h-4 text-blue-600 mr-2" />
            <span className="text-sm font-semibold text-gray-900">
              {article.domain}
            </span>
          </div>

          {article.domainData && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Domain Rating */}
              {article.domainData.domain_rating !== undefined &&
                article.domainData.domain_rating !== null && (
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-1">DR:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded-full ${
                        article.domainData.domain_rating >= 70
                          ? "bg-green-100 text-green-800"
                          : article.domainData.domain_rating >= 40
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {article.domainData.domain_rating}
                    </span>
                  </div>
                )}

              {/* Domain Age */}
              {article.domainData.domain_age !== undefined &&
                article.domainData.domain_age !== null && (
                  <div className="flex items-center">
                    <span className="text-gray-600 mr-1">Age:</span>
                    <span className="font-semibold text-gray-900">
                      {article.domainData.domain_age}y
                    </span>
                  </div>
                )}

              {/* Categories */}
              {article.domainData.categories && (
                <div className="col-span-2 flex flex-wrap gap-1 mt-1">
                  {article.domainData.categories
                    .split(",")
                    .slice(0, 3)
                    .map((cat, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {cat.trim()}
                      </span>
                    ))}
                  {article.domainData.categories.split(",").length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{article.domainData.categories.split(",").length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Article Meta */}
        <div className="flex items-center text-sm text-gray-500 mb-4">
          <Calendar className="w-4 h-4 mr-1" />
          <span>Published {formatDate(article.created_at)}</span>
        </div>

        {/* Unavailability Reason */}
        {!isAvailable && availabilityReason && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
            <p className="text-sm text-gray-600">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {availabilityReason}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">$15</span> per
            backlink
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Preview Button */}
            <button
              onClick={() => onPreviewClick(article)}
              className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              title="Preview article"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Preview
            </button>

            {/* Purchase Button */}
            <button
              onClick={() => onPurchaseClick(article)}
              disabled={!isAvailable || isLoading}
              className={`inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isAvailable && !isLoading
                  ? "text-white bg-blue-600 hover:bg-blue-700"
                  : "text-gray-400 bg-gray-200 cursor-not-allowed"
              }`}
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">
                {isLoading
                  ? "Loading..."
                  : isAvailable
                  ? "Purchase"
                  : "Unavailable"}
              </span>
              <span className="sm:hidden">
                {isLoading ? "Loading..." : isAvailable ? "Buy" : "N/A"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
