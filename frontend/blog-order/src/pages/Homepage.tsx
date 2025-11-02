import { useState, useEffect, useMemo } from "react";
import { getBrowseArticles } from "../services/purchaseService";
import type { PublicArticle } from "../types/purchase";
import ArticleGrid from "../components/ArticleGrid";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";
import CartIcon from "../components/CartIcon";
import ShoppingCart from "../components/ShoppingCart";

export default function Homepage() {
  const [articles, setArticles] = useState<PublicArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDRMin, setFilterDRMin] = useState<number | "">("");
  const [filterDRMax, setFilterDRMax] = useState<number | "">("");
  const [filterAgeMin, setFilterAgeMin] = useState<number | "">("");
  const [filterAgeMax, setFilterAgeMax] = useState<number | "">("");
  const [filterCategory, setFilterCategory] = useState("");

  useEffect(() => {
    loadArticles();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(searchTerm.trim().toLowerCase()),
      300
    );
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  // Filter articles by search and metadata
  const filteredArticles = useMemo(() => {
    const term = debouncedSearch;
    return articles.filter((article) => {
      // Text search: title, domain, niche, keyword
      if (term) {
        const haystack = `${article.title} ${article.domain}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      // Domain metadata filters
      const domainData = article.domainData;
      if (!domainData) return true; // If no domain data, include by default

      // DR filters
      if (
        filterDRMin !== "" &&
        (domainData.domain_rating === undefined ||
          domainData.domain_rating < Number(filterDRMin))
      )
        return false;
      if (
        filterDRMax !== "" &&
        (domainData.domain_rating === undefined ||
          domainData.domain_rating > Number(filterDRMax))
      )
        return false;

      // Age filters
      if (
        filterAgeMin !== "" &&
        (domainData.domain_age === undefined ||
          domainData.domain_age < Number(filterAgeMin))
      )
        return false;
      if (
        filterAgeMax !== "" &&
        (domainData.domain_age === undefined ||
          domainData.domain_age > Number(filterAgeMax))
      )
        return false;

      // Category filter
      if (filterCategory) {
        const cats = (domainData.categories || "")
          .toLowerCase()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (!cats.some((c) => c.includes(filterCategory.toLowerCase())))
          return false;
      }

      return true;
    });
  }, [
    articles,
    debouncedSearch,
    filterDRMin,
    filterDRMax,
    filterAgeMin,
    filterAgeMax,
    filterCategory,
  ]);

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
      {/* Shopping Cart Drawer */}
      <ShoppingCart />

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Cart Icon - Positioned absolutely in top right */}
          <div className="absolute top-4 right-4">
            <CartIcon />
          </div>

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

        {/* Search & Filter Controls */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-8 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Search & Filter Articles
          </h3>

          <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="w-full">
              <input
                type="text"
                placeholder="Search by title or domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Category (e.g., tech)"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="p-2 border border-gray-300 rounded-lg text-sm"
              />

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min DR"
                  value={filterDRMin === "" ? "" : String(filterDRMin)}
                  onChange={(e) =>
                    setFilterDRMin(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max="100"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="number"
                  placeholder="Max DR"
                  value={filterDRMax === "" ? "" : String(filterDRMax)}
                  onChange={(e) =>
                    setFilterDRMax(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                  max="100"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min Age"
                  value={filterAgeMin === "" ? "" : String(filterAgeMin)}
                  onChange={(e) =>
                    setFilterAgeMin(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="number"
                  placeholder="Max Age"
                  value={filterAgeMax === "" ? "" : String(filterAgeMax)}
                  onChange={(e) =>
                    setFilterAgeMax(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  min="0"
                />
              </div>

              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterCategory("");
                  setFilterDRMin("");
                  setFilterDRMax("");
                  setFilterAgeMin("");
                  setFilterAgeMax("");
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Clear Filters
              </button>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-600">
              Showing{" "}
              <span className="font-semibold">{filteredArticles.length}</span>{" "}
              of <span className="font-semibold">{articles.length}</span>{" "}
              articles
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            Available Articles
          </h2>
          {filteredArticles.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">
                {articles.length === 0
                  ? "No articles available for purchase at the moment."
                  : "No articles match your search criteria. Try adjusting your filters."}
              </p>
              {articles.length === 0 ? (
                <button
                  onClick={loadArticles}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Refresh
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterCategory("");
                    setFilterDRMin("");
                    setFilterDRMax("");
                    setFilterAgeMin("");
                    setFilterAgeMax("");
                  }}
                  className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <ArticleGrid
              articles={filteredArticles}
              onArticleUpdate={loadArticles}
            />
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
