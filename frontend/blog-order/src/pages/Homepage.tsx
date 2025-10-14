import { useState, useEffect } from "react";
import { getBrowseArticles } from "../services/purchaseService";
import type { PublicArticle } from "../types/purchase";
import ArticleGrid from "../components/ArticleGrid";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

export default function Homepage() {
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBrowseArticles();
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage message={error} onRetry={loadArticles} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              Premium Content & Backlink Services
            </h1>
            <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto">
              Choose between purchasing contextual backlinks in existing
              articles or commissioning custom AI-generated articles for our
              premium domains.
            </p>
          </div>
        </div>
      </header>

      {/* Service Options */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Backlink Service */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.101m-.758 4.899L12 12l1.414-1.414L16.828 14"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Purchase Backlinks
              </h2>
              <p className="text-gray-600 mb-4">
                Get contextual backlinks integrated into our existing
                high-quality articles.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <span className="text-lg font-semibold text-blue-900">
                  $15 per backlink
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Browse available articles below to purchase backlinks
              </p>
            </div>
          </div>

          {/* Article Generation Service */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-center">
              <div className="bg-green-100 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Request Custom Article
              </h2>
              <p className="text-gray-600 mb-4">
                Commission AI-generated articles on our premium domains with
                your specifications.
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <span className="text-lg font-semibold text-green-900">
                  $25 per article
                </span>
              </div>
              <button
                onClick={() => (window.location.href = "/request-article")}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                Request Article
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pricing Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-8">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg sm:text-xl font-semibold text-blue-900 mb-2">
                Fixed Price: $15 per Backlink
              </h2>
              <p className="text-sm sm:text-base text-blue-700">
                Each backlink is contextually integrated into high-quality
                articles and reviewed by our team
              </p>
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            Available Articles ({articles.length})
          </h2>
          {articles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                No articles available for purchase at the moment.
              </p>
              <button
                onClick={loadArticles}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <ArticleGrid articles={articles} onArticleUpdate={loadArticles} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>© 2024 Premium Article Backlinks. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
