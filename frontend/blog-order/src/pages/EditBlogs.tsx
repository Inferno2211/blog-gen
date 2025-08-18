import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getArticle,
  editArticleContent,
  editArticleContentDirect,
} from "../services/articlesService";
import type { Article, ArticleVersion } from "../types/article";
import BlogLayout from "../components/BlogLayout";
import { parseMarkdownWithFrontmatter } from "../utils/markdownParser";

const EditBlogs = () => {
  const { articleId } = useParams<{ articleId?: string }>();
  const navigate = useNavigate();

  // State for editing
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ArticleVersion | null>(
    null
  );
  const [editableContent, setEditableContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Editing options
  const [useAI, setUseAI] = useState(false);
  const [model, setModel] = useState("gemini-2.5-flash");
  const [provider, setProvider] = useState("gemini");

  // Load specific article if articleId is provided
  useEffect(() => {
    if (articleId) {
      loadArticleForEditing(articleId);
    } else {
      showMessage("error", "No article ID provided");
    }
  }, [articleId]);

  // Track content changes
  useEffect(() => {
    if (selectedVersion && editableContent !== selectedVersion.content_md) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  }, [editableContent, selectedVersion]);

  const loadArticleForEditing = async (id: string) => {
    try {
      setLoading(true);
      const article = await getArticle(id);
      setSelectedArticle(article);

      // Find the selected version or use the first available version
      let version = null;
      if (article.selected_version_id) {
        version =
          article.versions.find((v) => v.id === article.selected_version_id) ||
          null;
      }
      if (!version && article.versions.length > 0) {
        version = article.versions[0];
      }

      setSelectedVersion(version);
      setEditableContent(version?.content_md || "");
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to load article:", error);
      showMessage("error", "Failed to load article for editing");
    } finally {
      setLoading(false);
    }
  };

  const selectVersion = (version: ArticleVersion) => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to switch versions?"
      );
      if (!confirmed) return;
    }

    setSelectedVersion(version);
    setEditableContent(version.content_md);
    setIsDirty(false);
  };

  const saveContent = async () => {
    if (!selectedArticle || !editableContent.trim()) {
      showMessage("error", "No content to save");
      return;
    }

    try {
      setSaving(true);

      // Use AI processing or direct edit based on user choice
      const result = useAI
        ? await editArticleContent(
            selectedArticle.id,
            editableContent,
            useAI,
            model,
            provider
          )
        : await editArticleContentDirect(selectedArticle.id, editableContent);

      // Reload the article to get the updated version
      await loadArticleForEditing(selectedArticle.id);

      const status =
        selectedArticle.status === "PUBLISHED" ? "published" : "draft";
      const fileMsg = result.fileUpdated
        ? " and published file synchronized"
        : "";
      const editMethod =
        result.editMethod === "AI_PROCESSED"
          ? " (AI processed)"
          : " (direct edit)";
      showMessage(
        "success",
        `Article ${status} updated successfully${fileMsg}${editMethod}`
      );
    } catch (error) {
      console.error("Failed to save article:", error);
      showMessage(
        "error",
        `Failed to save article: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const getStatusBadgeColor = (status: string) => {
    const colors = {
      DRAFT: "bg-gray-100 text-gray-800",
      PUBLISHED: "bg-green-100 text-green-800",
      ARCHIVED: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
      GENERATED: "bg-blue-100 text-blue-800",
      FLAGGED_BY_AI: "bg-orange-100 text-orange-800",
      APPROVED_BY_AI: "bg-purple-100 text-purple-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  // Parse content for preview
  const parsedContent = parseMarkdownWithFrontmatter(editableContent);

  if (!articleId) {
    return (
      <div className="max-w-7xl mx-auto py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            No Article Selected
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please provide an article ID in the URL to edit an article.
          </p>
          <Link
            to="/blogs"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ← Back to Articles
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-10">
        <div className="text-center">Loading article...</div>
      </div>
    );
  }

  if (!selectedArticle) {
    return (
      <div className="max-w-7xl mx-auto py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Article Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The article you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Link
            to="/blogs"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ← Back to Articles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/blogs"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Back to Articles
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {selectedArticle.slug}
              </h1>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Domain: {selectedArticle.domain?.name || "None"} • Topic:{" "}
                {selectedArticle.topic || "None"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 text-sm rounded-full ${getStatusBadgeColor(
                selectedArticle.status
              )}`}
            >
              {selectedArticle.status}
            </span>
            {isDirty && (
              <span className="text-sm text-orange-600 dark:text-orange-400">
                Unsaved changes
              </span>
            )}
            <button
              onClick={saveContent}
              disabled={saving || !isDirty}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                saving || !isDirty
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : useAI
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {saving
                ? "Saving..."
                : useAI
                ? "Save with AI"
                : "Save Directly"}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mt-3 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : message.type === "error"
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Version Selector */}
        {selectedArticle.versions.length > 1 && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Version to Edit ({selectedArticle.versions.length} available)
            </label>
            <div className="flex gap-2 overflow-x-auto">
              {selectedArticle.versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => selectVersion(version)}
                  className={`text-left p-2 rounded-lg border text-sm transition-colors whitespace-nowrap ${
                    selectedVersion?.id === version.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    Version {version.version_num}
                    {selectedArticle.selected_version_id === version.id && (
                      <span className="ml-1 text-xs text-green-600">Current</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(version.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex">
        {/* Left Side - Editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Editing Options */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Editing Options
            </h3>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="editMode"
                  checked={!useAI}
                  onChange={() => setUseAI(false)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Direct Edit
                </span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="editMode"
                  checked={useAI}
                  onChange={() => setUseAI(true)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  AI-Assisted
                </span>
              </label>
            </div>

            {useAI && (
              <div className="mt-3 flex gap-2">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="text-xs p-1 border border-gray-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="text-xs p-1 border border-gray-300 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 p-4">
            <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              {selectedArticle.status === "PUBLISHED" ? (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-2 text-xs">
                  <strong>Published Article:</strong> Changes will update both database and published file.
                </div>
              ) : (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2 text-xs">
                  <strong>Draft Article:</strong> Changes saved to database only.
                </div>
              )}
            </div>

            <textarea
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              className="w-full h-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-none font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Enter your markdown content here..."
            />
          </div>
        </div>

        {/* Right Side - Preview */}
        <div className="w-1/2 flex flex-col bg-gray-50 dark:bg-gray-900">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Live Preview
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Real-time preview of your blog post
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            <BlogLayout
              frontmatter={parsedContent.frontmatter}
              content={parsedContent.content}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBlogs;
