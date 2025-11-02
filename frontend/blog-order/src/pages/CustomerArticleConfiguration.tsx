import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { parseMarkdownWithFrontmatter } from "../utils/markdownParser";
import BlogLayout from "../components/BlogLayout";
import {
  getOrderDetails,
  customerConfigureArticle,
  customerRegenerateArticle,
  customerSubmitArticleForReview,
} from "../services/purchaseService";

interface OrderDetails {
  id: string;
  sessionId: string;
  articleId: string;
  customerEmail: string;
  backlinkData: {
    keyword: string;
    target_url: string;
    notes?: string;
  };
  status: string;
  generatedVersion?: {
    id: string;
    version_num: number;
    content_md: string;
    backlink_review_status: string;
  } | null;
  article: {
    id: string;
    slug: string;
    topic?: string;
    niche?: string;
    keyword?: string;
    domain: {
      slug: string;
      name: string;
    };
    selected_version?: {
      id: string;
      version_num: number;
      content_md: string;
    };
  };
}

interface ArticleConfigurationRequest {
  orderId: string;
  title: string;
  niche: string;
  keyword: string;
  topic: string;
  targetURL: string;
  anchorText: string;
  model: string;
  provider: string;
}

interface ArticleConfigurationResponse {
  success: boolean;
  message: string;
  versionId: string;
  versionNum: number;
  content: string;
  previewContent: string;
}

const CustomerArticleConfiguration: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("order_id") || searchParams.get("orderId");

  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedVersion, setGeneratedVersion] =
    useState<ArticleConfigurationResponse | null>(null);

  const [formData, setFormData] = useState<ArticleConfigurationRequest>({
    orderId: orderId || "",
    title: "",
    niche: "",
    keyword: "",
    topic: "",
    targetURL: "",
    anchorText: "",
    model: "gemini-2.5-flash",
    provider: "gemini",
  });

  useEffect(() => {
    if (!orderId) {
      navigate("/");
      return;
    }

    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const data = await getOrderDetails(orderId!);
      setOrderDetails(data.order);

      // Pre-fill form with domain information if available
      if (data.order.article?.domain) {
        setFormData((prev) => ({
          ...prev,
          niche: data.order.article.niche || prev.niche,
          keyword: data.order.article.keyword || prev.keyword,
          topic: data.order.article.topic || prev.topic,
        }));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load order details"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateArticle = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await customerConfigureArticle(formData);
      setGeneratedVersion(result);
      setSuccess(
        `Article generated successfully! Created version ${result.versionNum}.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate article"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateContent = async () => {
    if (!generatedVersion) return;

    setGenerating(true);
    setError(null);

    try {
      const result = await customerRegenerateArticle({
        ...formData,
        versionId: generatedVersion.versionId,
      });
      setGeneratedVersion(result);
      setSuccess(
        `Article regenerated successfully! Updated version ${result.versionNum}.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate article"
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!generatedVersion || !orderDetails) return;

    setSubmittingReview(true);
    setError(null);

    try {
      await customerSubmitArticleForReview({
        orderId: formData.orderId,
        versionId: generatedVersion.versionId,
      });
      setSuccess(
        "Your article has been submitted for admin review. You will be notified via email once it's approved and published."
      );

      // Redirect to thank you page after 3 seconds
      setTimeout(() => {
        navigate("/review-submitted");
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit for review"
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const parsed = generatedVersion
    ? parseMarkdownWithFrontmatter(generatedVersion.content)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Configure Your Article
          </h1>

          {orderDetails && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900">Order Details</h3>
              <p className="text-blue-800">Order ID: {orderDetails.id}</p>
              <p className="text-blue-800">
                Domain: {orderDetails.article?.domain?.name}
              </p>
              <p className="text-blue-800">Status: {orderDetails.status}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800">{success}</p>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerateArticle();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Article Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={generating}
                  placeholder="Enter a compelling article title"
                />
              </div>

              <div>
                <label
                  htmlFor="topic"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Topic *
                </label>
                <input
                  type="text"
                  id="topic"
                  name="topic"
                  value={formData.topic}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={generating}
                  placeholder="What should this article focus on?"
                />
              </div>

              <div>
                <label
                  htmlFor="niche"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Niche
                </label>
                <input
                  type="text"
                  id="niche"
                  name="niche"
                  value={formData.niche}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                  placeholder="e.g., Technology, Health, Finance"
                />
              </div>

              <div>
                <label
                  htmlFor="keyword"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Target Keyword
                </label>
                <input
                  type="text"
                  id="keyword"
                  name="keyword"
                  value={formData.keyword}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                  placeholder="Primary SEO keyword to target"
                />
              </div>

              <div>
                <label
                  htmlFor="targetURL"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Target URL (Optional)
                </label>
                <input
                  type="url"
                  id="targetURL"
                  name="targetURL"
                  value={formData.targetURL}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                  placeholder="https://example.com (if you want a backlink)"
                />
              </div>

              <div>
                <label
                  htmlFor="anchorText"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Anchor Text (Optional)
                </label>
                <input
                  type="text"
                  id="anchorText"
                  name="anchorText"
                  value={formData.anchorText}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                  placeholder="Text to link to your URL"
                />
              </div>

              <div>
                <label
                  htmlFor="model"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  AI Model
                </label>
                <select
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="provider"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Provider
                </label>
                <select
                  id="provider"
                  name="provider"
                  value={formData.provider}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={generating}
                >
                  <option value="gemini">Gemini</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={generating || !formData.title || !formData.topic}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                    Generating Article...
                  </span>
                ) : (
                  "Generate Article"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Article Preview */}
        {generatedVersion && parsed && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Article Preview</h2>
              <span className="text-sm text-gray-500">
                Version {generatedVersion.versionNum}
              </span>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white mb-6">
              <div className="p-4">
                <BlogLayout
                  frontmatter={parsed.frontmatter}
                  content={parsed.content}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRegenerateContent}
                disabled={generating}
                className="px-6 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 transition-colors"
              >
                {generating ? "Regenerating..." : "Regenerate"}
              </button>

              <button
                onClick={handleSubmitForReview}
                disabled={submittingReview}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
              >
                {submittingReview ? "Submitting..." : "Submit for Review"}
              </button>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-700 mb-2">Preview Text:</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {generatedVersion.previewContent}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerArticleConfiguration;
