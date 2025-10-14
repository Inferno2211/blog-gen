import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getBrowseDomains,
  initiateArticlePurchase,
} from "../services/purchaseService";
import type { Domain } from "../types/domain";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

interface ArticleRequestForm {
  domainId: string;
  articleTitle: string;
  topic: string;
  niche: string;
  keyword: string;
  email: string;
  notes: string;
}

export default function RequestArticle() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  const [formData, setFormData] = useState<ArticleRequestForm>({
    domainId: "",
    articleTitle: "",
    topic: "",
    niche: "",
    keyword: "",
    email: "",
    notes: "",
  });

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getBrowseDomains();
      setDomains(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  const handleDomainSelect = (domain: Domain) => {
    setSelectedDomain(domain);
    setFormData((prev) => ({
      ...prev,
      domainId: domain.id,
      niche: domain.tags || prev.niche, // Pre-fill niche from domain tags
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await initiateArticlePurchase({
        domainId: formData.domainId,
        articleTitle: formData.articleTitle,
        topic: formData.topic,
        niche: formData.niche,
        keyword: formData.keyword,
        email: formData.email,
        notes: formData.notes,
      });

      // Redirect to payment page
      if (response.paymentUrl) {
        window.location.href = response.paymentUrl;
      } else {
        throw new Error("Payment URL not received");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initiate purchase"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && domains.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <ErrorMessage message={error} onRetry={loadDomains} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Request Custom Article
              </h1>
              <p className="text-gray-600 mt-2">
                Commission an AI-generated article for one of our premium
                domains
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pricing Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-green-900 mb-2">
              Custom Article Generation - $25
            </h2>
            <p className="text-green-800">
              Get a high-quality, AI-generated article published on your chosen
              domain
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!selectedDomain ? (
          /* Domain Selection */
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 1: Choose a Domain
            </h2>
            <p className="text-gray-600 mb-6">
              Select the domain where you'd like your article to be published:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains.map((domain) => (
                <button
                  key={domain.id}
                  onClick={() => handleDomainSelect(domain)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {domain.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{domain.slug}</p>
                  {domain.tags && (
                    <p className="text-xs text-green-600 bg-green-100 rounded px-2 py-1 inline-block">
                      {domain.tags}
                    </p>
                  )}
                </button>
              ))}
            </div>

            {domains.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No domains available at the moment.
                </p>
                <button
                  onClick={loadDomains}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Article Configuration Form */
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-sm border p-6"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 2: Configure Your Article
            </h2>

            {/* Selected Domain Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-green-900">
                    Selected Domain
                  </h3>
                  <p className="text-green-800">
                    {selectedDomain.name} ({selectedDomain.slug})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDomain(null);
                    setFormData((prev) => ({
                      ...prev,
                      domainId: "",
                      niche: "",
                    }));
                  }}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  Change Domain
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Article Title *
                </label>
                <input
                  type="text"
                  name="articleTitle"
                  value={formData.articleTitle}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter a compelling article title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Topic *
                </label>
                <input
                  type="text"
                  name="topic"
                  value={formData.topic}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Main topic of the article"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Niche
                </label>
                <input
                  type="text"
                  name="niche"
                  value={formData.niche}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Article niche (auto-filled from domain)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Keyword
                </label>
                <input
                  type="text"
                  name="keyword"
                  value={formData.keyword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Target SEO keyword"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="your@email.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Any specific requirements, style preferences, or additional information..."
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-green-600 text-white py-3 px-6 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {submitting ? "Processing..." : "Proceed to Payment ($25)"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex-1 sm:flex-none bg-gray-200 text-gray-800 py-3 px-6 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
