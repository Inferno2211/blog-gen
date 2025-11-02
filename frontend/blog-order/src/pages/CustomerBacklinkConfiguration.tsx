import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { parseMarkdownWithFrontmatter } from "../utils/markdownParser";
import BlogLayout from "../components/BlogLayout";
import {
  getOrderDetails,
  customerIntegrateBacklink,
  customerRegenerateBacklink,
  customerSubmitForReview,
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

interface BacklinkConfigurationRequest {
  orderId: string;
  backlinkUrl: string;
  anchorText: string;
  model?: string;
  provider?: string;
}

interface BacklinkConfigurationResponse {
  success: boolean;
  message: string;
  versionId: string;
  versionNum: number;
  content: string;
  previewContent: string;
}

const CustomerBacklinkConfiguration: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [integrating, setIntegrating] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [generatedVersion, setGeneratedVersion] =
    useState<BacklinkConfigurationResponse | null>(null);

  const [formData, setFormData] = useState<BacklinkConfigurationRequest>({
    orderId: "",
    backlinkUrl: "",
    anchorText: "",
    model: "gemini-2.5-flash",
    provider: "gemini",
  });

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const orderId = searchParams.get("order_id");

    if (!sessionId || !orderId) {
      setError("Invalid configuration link");
      setLoading(false);
      return;
    }

    loadOrderDetails(orderId);
  }, [searchParams]);

  const loadOrderDetails = async (orderId: string) => {
    try {
      setLoading(true);
      const data = await getOrderDetails(orderId);
      setOrderDetails(data.order);

      // If the order already has a generated version, set it in state
      if (data.order.generatedVersion) {
        setGeneratedVersion({
          success: true,
          message: "Backlink previously configured",
          versionId: data.order.generatedVersion.id,
          versionNum: data.order.generatedVersion.version_num,
          content: data.order.generatedVersion.content_md,
          previewContent: data.order.generatedVersion.content_md,
        });
      }

      // Pre-populate form data
      setFormData({
        orderId: orderId,
        backlinkUrl: data.order.backlinkData.target_url || "",
        anchorText: data.order.backlinkData.keyword || "",
        model: "gemini-2.5-flash",
        provider: "gemini",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load order details"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleIntegrateBacklink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await customerIntegrateBacklink(formData);
      setGeneratedVersion(result);
      setSuccess(
        `Backlink integrated successfully! Created version ${result.versionNum} for the article.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to integrate backlink"
      );
    } finally {
      setIntegrating(false);
    }
  };

  const handleRegenerateContent = async () => {
    if (!generatedVersion) return;

    setIntegrating(true);
    setError(null);

    try {
      const result = await customerRegenerateBacklink({
        orderId: formData.orderId,
        versionId: generatedVersion.versionId,
        backlinkUrl: formData.backlinkUrl,
        anchorText: formData.anchorText,
        model: formData.model,
        provider: formData.provider,
      });
      setGeneratedVersion(result);
      setSuccess(
        `Content regenerated successfully! Updated version ${result.versionNum}.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate content"
      );
    } finally {
      setIntegrating(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!generatedVersion || !orderDetails) return;

    setSubmittingReview(true);
    setError(null);

    try {
      await customerSubmitForReview({
        orderId: formData.orderId,
        versionId: generatedVersion.versionId,
      });
      setSuccess(
        "Your article has been submitted for admin review. You will be notified via email once it's approved and published."
      );

      // Redirect to a thank you page after 3 seconds
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

  const renderArticlePreview = () => {
    if (!orderDetails?.article.selected_version) return null;

    try {
      const parsed = parseMarkdownWithFrontmatter(
        orderDetails.article.selected_version.content_md
      );

      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4">
            Current Article Content
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-700">
                  <strong>Title:</strong>{" "}
                  {parsed.frontmatter?.title || "Untitled"}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Domain:</strong> {orderDetails.article.domain.name}
                </p>
                <p className="text-sm text-gray-700">
                  <strong>Version:</strong>{" "}
                  {orderDetails.article.selected_version.version_num}
                </p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <h4 className="font-semibold mb-2 px-4 py-2 bg-gray-100 border-b">
                Article Preview
              </h4>
              <div className="p-4">
                <BlogLayout
                  frontmatter={parsed.frontmatter}
                  content={parsed.content}
                />
              </div>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            Current Article Content
          </h3>
          <p className="text-red-600">
            Failed to parse article content for preview. Showing raw content
            instead.
          </p>
          <div className="mt-2 p-2 bg-white rounded border">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {orderDetails?.article.selected_version?.content_md}
            </pre>
          </div>
        </div>
      );
    }
  };

  const renderGeneratedContent = () => {
    if (!generatedVersion) return null;

    try {
      const parsed = parseMarkdownWithFrontmatter(generatedVersion.content);

      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-4">
            Generated Content with Backlink
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-green-800">
                  <strong>Version:</strong> {generatedVersion.versionNum}
                </p>
                <p className="text-sm text-green-800">
                  <strong>Backlink URL:</strong>
                </p>
                <a
                  href={formData.backlinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm break-all"
                >
                  {formData.backlinkUrl}
                </a>
                <p className="text-sm text-green-800 mt-2">
                  <strong>Anchor Text:</strong> {formData.anchorText}
                </p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <h4 className="font-semibold mb-2 px-4 py-2 bg-gray-100 border-b">
                Article Preview with Backlink
              </h4>
              <div className="p-4">
                <BlogLayout
                  frontmatter={parsed.frontmatter}
                  content={parsed.content}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRegenerateContent}
                disabled={integrating}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 disabled:opacity-50"
              >
                {integrating ? "Regenerating..." : "Regenerate Content"}
              </button>
              <button
                onClick={handleSubmitForReview}
                disabled={submittingReview}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {submittingReview ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </div>
        </div>
      );
    } catch (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-900 mb-2">
            Generated Content with Backlink
          </h3>
          <p className="text-red-700">
            Failed to parse generated content for preview. Showing raw content
            instead.
          </p>
          <div className="mt-2 p-2 bg-white rounded border">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
              {generatedVersion.content}
            </pre>
          </div>
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your order details...</p>
        </div>
      </div>
    );
  }

  if (error && !orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => navigate("/")}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {orderDetails?.generatedVersion
              ? "Your Backlink Configuration"
              : "Configure Your Backlink"}
          </h1>
          <p className="text-gray-600">
            {orderDetails?.generatedVersion
              ? "Your backlink has been configured and is ready for review. You can regenerate the content or submit it for approval."
              : "Payment successful! Now configure your backlink and integrate it into the article."}
          </p>
          {orderDetails && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900">Order Details</h3>
              <p className="text-blue-800">Order ID: {orderDetails.id}</p>
              <p className="text-blue-800">
                Article:{" "}
                {orderDetails.article.topic || orderDetails.article.slug}
              </p>
              <p className="text-blue-800">
                Email: {orderDetails.customerEmail}
              </p>
              <p className="text-blue-800">
                Status:{" "}
                <span className="font-semibold capitalize">
                  {orderDetails.status.replace("_", " ")}
                </span>
              </p>
              {orderDetails.generatedVersion && (
                <p className="text-blue-800">
                  Generated Version: {orderDetails.generatedVersion.version_num}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Article Preview */}
        {orderDetails && <div className="mb-6">{renderArticlePreview()}</div>}

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        {/* Backlink Configuration Form */}
        {!generatedVersion && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900">
              Configure Backlink Details
            </h2>

            <form onSubmit={handleIntegrateBacklink} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target URL *
                </label>
                <input
                  type="url"
                  name="backlinkUrl"
                  value={formData.backlinkUrl}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/target-page"
                />
                <p className="text-sm text-gray-500 mt-1">
                  The URL you want to link to from the article
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Anchor Text *
                </label>
                <input
                  type="text"
                  name="anchorText"
                  value={formData.anchorText}
                  onChange={handleChange}
                  required
                  maxLength={200}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Click here to learn more"
                />
                <p className="text-sm text-gray-500 mt-1">
                  The clickable text that will link to your URL
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    AI Provider
                  </label>
                  <select
                    name="provider"
                    value={formData.provider}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gemini">Gemini</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  <select
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="gemini-2.5-flash">
                      Gemini 2.5 Flash (Recommended)
                    </option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </select>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={integrating}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {integrating ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Integrating Backlink...
                    </div>
                  ) : (
                    "Integrate Backlink"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Generated Content Preview */}
        {generatedVersion && (
          <div className="mb-6">{renderGeneratedContent()}</div>
        )}

        {/* Information Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            Next Steps
          </h3>
          <div className="space-y-3">
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                1
              </div>
              <div>
                <p className="text-blue-800 font-medium">
                  Configure Your Backlink
                </p>
                <p className="text-blue-700 text-sm">
                  Enter your target URL and preferred anchor text
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                2
              </div>
              <div>
                <p className="text-blue-800 font-medium">Generate & Preview</p>
                <p className="text-blue-700 text-sm">
                  AI will integrate your backlink naturally into the article
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3 mt-0.5">
                3
              </div>
              <div>
                <p className="text-blue-800 font-medium">Submit for Review</p>
                <p className="text-blue-700 text-sm">
                  Once satisfied, submit for admin approval and publication
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerBacklinkConfiguration;
