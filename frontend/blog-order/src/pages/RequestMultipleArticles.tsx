import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBrowseDomains } from "../services/purchaseService";
import type { Domain } from "../types/domain";
import LoadingSpinner from "../components/LoadingSpinner";
import ErrorMessage from "../components/ErrorMessage";

interface ArticleRequest {
  id: string;
  articleTitle: string;
  topic: string;
  niche: string;
  keyword: string;
  includeBacklink: boolean;
  targetUrl: string;
  anchorText: string;
  notes: string;
}

export default function RequestMultipleArticles() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [email, setEmail] = useState("");

  // Array of article requests
  const [articleRequests, setArticleRequests] = useState<ArticleRequest[]>([
    {
      id: crypto.randomUUID(),
      articleTitle: "",
      topic: "",
      niche: "",
      keyword: "",
      includeBacklink: false,
      targetUrl: "",
      anchorText: "",
      notes: "",
    },
  ]);

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
    // Pre-fill niche for all articles
    setArticleRequests((prev) =>
      prev.map((req) => ({
        ...req,
        niche: domain.tags || req.niche,
      }))
    );
  };

  const handleAddArticle = () => {
    if (articleRequests.length >= 10) {
      alert("Maximum 10 articles per request");
      return;
    }

    setArticleRequests((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        articleTitle: "",
        topic: "",
        niche: selectedDomain?.tags || "",
        keyword: "",
        includeBacklink: false,
        targetUrl: "",
        anchorText: "",
        notes: "",
      },
    ]);
  };

  const handleRemoveArticle = (id: string) => {
    if (articleRequests.length === 1) {
      alert("You must have at least one article request");
      return;
    }
    setArticleRequests((prev) => prev.filter((req) => req.id !== id));
  };

  const handleArticleChange = (
    id: string,
    field: keyof ArticleRequest,
    value: any
  ) => {
    setArticleRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              [field]: value,
            }
          : req
      )
    );
  };

  const validateForm = () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return false;
    }

    for (let i = 0; i < articleRequests.length; i++) {
      const req = articleRequests[i];

      if (!req.articleTitle.trim()) {
        setError(`Article ${i + 1}: Title is required`);
        return false;
      }

      if (!req.topic.trim()) {
        setError(`Article ${i + 1}: Topic is required`);
        return false;
      }

      if (req.includeBacklink) {
        if (!req.targetUrl.trim()) {
          setError(`Article ${i + 1}: Target URL is required for backlink`);
          return false;
        }

        if (!req.anchorText.trim()) {
          setError(`Article ${i + 1}: Anchor text is required for backlink`);
          return false;
        }

        try {
          new URL(req.targetUrl);
        } catch {
          setError(`Article ${i + 1}: Invalid target URL format`);
          return false;
        }
      }
    }

    // Check for duplicate topics
    const topics = articleRequests.map((r) => r.topic.toLowerCase().trim());
    const uniqueTopics = new Set(topics);
    if (uniqueTopics.size !== topics.length) {
      setError(
        "Duplicate topics detected. Each article must have a unique topic."
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Call backend API
      const response = await fetch(
        `${import.meta.env.VITE_REACT_APP_API_URL}/v${
          import.meta.env.VITE_REACT_APP_API_VERSION
        }/purchase/initiate-multi-article`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            domainId: selectedDomain!.id,
            email: email.trim(),
            articleRequests: articleRequests.map((req) => ({
              articleTitle: req.articleTitle.trim(),
              topic: req.topic.trim(),
              niche: req.niche.trim(),
              keyword: req.keyword.trim(),
              targetUrl: req.includeBacklink ? req.targetUrl.trim() : undefined,
              anchorText: req.includeBacklink
                ? req.anchorText.trim()
                : undefined,
              notes: req.notes.trim(),
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate request");
      }

      if (data.success && data.sessionId) {
        // Navigate to confirmation page
        navigate(
          `/multi-article-confirmation?session_id=${
            data.sessionId
          }&email=${encodeURIComponent(email)}&count=${articleRequests.length}`
        );
      } else {
        throw new Error("Failed to send magic link");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initiate request"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalPrice = articleRequests.length * 25;

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                📚 Request Multiple Custom Articles
              </h1>
              <p className="text-gray-600 mt-2">
                Request multiple AI-generated articles for a single domain - $25
                per article
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Pricing Info */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-purple-900 mb-1">
                Multiple Article Generation
              </h2>
              <p className="text-purple-800 text-sm">
                Add up to 10 articles for a single domain, pay once for all
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-purple-600">
                ${totalPrice.toFixed(2)}
              </p>
              <p className="text-sm text-purple-700">
                {articleRequests.length} article
                {articleRequests.length !== 1 ? "s" : ""} × $25
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {!selectedDomain ? (
          /* Domain Selection */
          <div className="bg-white rounded-xl shadow-md border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Step 1: Choose Your Domain
            </h2>
            <p className="text-gray-600 mb-6">
              Select the domain where all your articles will be published:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains.map((domain) => (
                <button
                  key={domain.id}
                  onClick={() => handleDomainSelect(domain)}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                >
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-purple-700">
                    {domain.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{domain.slug}</p>
                  {domain.tags && (
                    <p className="text-xs text-purple-600 bg-purple-100 rounded px-2 py-1 inline-block">
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
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Article Requests Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selected Domain Info */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-purple-900">
                    Publishing Domain
                  </h3>
                  <p className="text-purple-800">
                    {selectedDomain.name} ({selectedDomain.slug})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        "Changing domain will reset all article requests. Continue?"
                      )
                    ) {
                      setSelectedDomain(null);
                      setArticleRequests([
                        {
                          id: crypto.randomUUID(),
                          articleTitle: "",
                          topic: "",
                          niche: "",
                          keyword: "",
                          includeBacklink: false,
                          targetUrl: "",
                          anchorText: "",
                          notes: "",
                        },
                      ]);
                    }
                  }}
                  className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  Change Domain
                </button>
              </div>
            </div>

            {/* Email */}
            <div className="bg-white rounded-xl shadow-md border p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="your@email.com"
              />
              <p className="text-sm text-gray-500 mt-1">
                We'll send a payment link to this email
              </p>
            </div>

            {/* Article Requests */}
            <div className="space-y-4">
              {articleRequests.map((article, index) => (
                <div
                  key={article.id}
                  className="bg-white rounded-xl shadow-md border p-6"
                >
                  {/* Article Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Article {index + 1}
                    </h3>
                    {articleRequests.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveArticle(article.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Article Title */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Article Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={article.articleTitle}
                        onChange={(e) =>
                          handleArticleChange(
                            article.id,
                            "articleTitle",
                            e.target.value
                          )
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter a compelling article title"
                      />
                    </div>

                    {/* Topic */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Topic <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={article.topic}
                        onChange={(e) =>
                          handleArticleChange(
                            article.id,
                            "topic",
                            e.target.value
                          )
                        }
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Main topic"
                      />
                    </div>

                    {/* Niche */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Niche
                      </label>
                      <input
                        type="text"
                        value={article.niche}
                        onChange={(e) =>
                          handleArticleChange(
                            article.id,
                            "niche",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Article niche"
                      />
                    </div>

                    {/* Keyword */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Keyword
                      </label>
                      <input
                        type="text"
                        value={article.keyword}
                        onChange={(e) =>
                          handleArticleChange(
                            article.id,
                            "keyword",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Target SEO keyword"
                      />
                    </div>

                    {/* Backlink Section */}
                    <div className="md:col-span-2 border-t border-gray-200 pt-4">
                      <div className="flex items-center mb-3">
                        <input
                          type="checkbox"
                          id={`backlink-${article.id}`}
                          checked={article.includeBacklink}
                          onChange={(e) =>
                            handleArticleChange(
                              article.id,
                              "includeBacklink",
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <label
                          htmlFor={`backlink-${article.id}`}
                          className="ml-2 text-sm font-medium text-gray-700"
                        >
                          Include my backlink in this article (no extra charge)
                        </label>
                      </div>

                      {article.includeBacklink && (
                        <div className="space-y-3 bg-gray-50 p-4 rounded-md">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Target URL <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="url"
                              value={article.targetUrl}
                              onChange={(e) =>
                                handleArticleChange(
                                  article.id,
                                  "targetUrl",
                                  e.target.value
                                )
                              }
                              placeholder="https://yourwebsite.com/page"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                              required={article.includeBacklink}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Anchor Text{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={article.anchorText}
                              onChange={(e) =>
                                handleArticleChange(
                                  article.id,
                                  "anchorText",
                                  e.target.value
                                )
                              }
                              placeholder="e.g., best content tools"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                              required={article.includeBacklink}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes
                      </label>
                      <textarea
                        value={article.notes}
                        onChange={(e) =>
                          handleArticleChange(
                            article.id,
                            "notes",
                            e.target.value
                          )
                        }
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Any specific requirements..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add More Button */}
            {articleRequests.length < 10 && (
              <button
                type="button"
                onClick={handleAddArticle}
                className="w-full py-3 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:border-purple-500 hover:bg-purple-50 font-medium flex items-center justify-center gap-2 transition-all"
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Add Another Article ({articleRequests.length}/10)
              </button>
            )}

            {/* Submit Buttons */}
            <div className="bg-white rounded-xl shadow-md border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">Total Articles:</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {articleRequests.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Price:</p>
                  <p className="text-3xl font-bold text-purple-600">
                    ${totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold shadow-md transition-all"
                >
                  {submitting ? (
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
                    `Proceed to Payment - $${totalPrice.toFixed(2)}`
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="flex-1 sm:flex-none bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
