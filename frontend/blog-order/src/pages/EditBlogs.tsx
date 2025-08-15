import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getAllArticles,
  getArticle,
  editArticleContent,
  editArticleContentDirect,
} from "../services/articlesService";
import type { Article, ArticleVersion } from "../types/article";

const EditBlogs = () => {
  const { articleId } = useParams<{ articleId?: string }>();
  const navigate = useNavigate();

  // State for article selection
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

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

  // Load articles list
  useEffect(() => {
    loadArticles();
  }, []);

  // Load specific article if articleId is provided
  useEffect(() => {
    if (articleId) {
      loadArticleForEditing(articleId);
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

  const loadArticles = async () => {
    try {
      setLoadingArticles(true);
      const response = await getAllArticles();
      setArticles(response);
    } catch (error) {
      console.error("Failed to load articles:", error);
      showMessage("error", "Failed to load articles");
    } finally {
      setLoadingArticles(false);
    }
  };

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

  const selectArticle = (article: Article) => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes. Are you sure you want to switch articles?"
      );
      if (!confirmed) return;
    }

    navigate(`/blogs/edit/${article.id}`);
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

  if (loadingArticles) {
    return (
      <div className="max-w-7xl mx-auto py-10">
        <div className="text-center">Loading articles...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Edit Articles
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Edit article content. Changes to published articles will update
              both database and files.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/blogs"
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Back to Articles
            </Link>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Articles List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Select Article ({articles.length})
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {articles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => selectArticle(article)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedArticle?.id === article.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {article.slug}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {article.domain?.name || "No domain"} •{" "}
                    {article.versions.length} versions
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(
                        article.status
                      )}`}
                    >
                      {article.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          {!selectedArticle ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-8 text-center">
              <div className="text-gray-500 dark:text-gray-400">
                Select an article from the sidebar to start editing
              </div>
            </div>
          ) : loading ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-8 text-center">
              <div className="text-gray-500 dark:text-gray-400">
                Loading article...
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Article Info */}
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {selectedArticle.slug}
                    </h2>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Domain: {selectedArticle.domain?.name || "None"} • Topic:{" "}
                      {selectedArticle.topic || "None"} • User:{" "}
                      {selectedArticle.user || "None"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-sm rounded-full ${getStatusBadgeColor(
                        selectedArticle.status
                      )}`}
                    >
                      {selectedArticle.status}
                    </span>
                    {selectedArticle.status === "PUBLISHED" && (
                      <span className="text-xs text-orange-600 dark:text-orange-400">
                        File sync enabled
                      </span>
                    )}
                  </div>
                </div>

                {/* Version Selector */}
                {selectedArticle.versions.length > 1 && (
                  <div className="border-t dark:border-gray-700 pt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Version to Edit ({selectedArticle.versions.length}{" "}
                      available)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {selectedArticle.versions.map((version) => (
                        <button
                          key={version.id}
                          onClick={() => selectVersion(version)}
                          className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                            selectedVersion?.id === version.id
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            Version {version.version_num}
                            {selectedArticle.selected_version_id ===
                              version.id && (
                              <span className="ml-2 text-xs text-green-600">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {new Date(version.created_at).toLocaleDateString()}{" "}
                            • QC: {version.last_qc_status || "Pending"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Content Editor */}
              {selectedVersion && (
                <>
                  {/* Editing Options */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      Editing Options
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <label className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          name="editMode"
                          checked={!useAI}
                          onChange={() => setUseAI(false)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-green-700 dark:text-green-400">
                            Direct Edit (Recommended)
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Fast and simple - saves exactly what you type
                            without any AI processing. Perfect for quick edits
                            and maintaining full control.
                          </div>
                        </div>
                      </label>

                      <label className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                        <input
                          type="radio"
                          name="editMode"
                          checked={useAI}
                          onChange={() => setUseAI(true)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-blue-700 dark:text-blue-400">
                            AI-Assisted Edit
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Processes content with AI - extracts metadata,
                            validates structure, and runs quality checks. Slower
                            but more thorough.
                          </div>
                        </div>
                      </label>
                    </div>

                    {useAI && (
                      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">
                          AI Processing Options
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                              AI Model
                            </label>
                            <select
                              value={model}
                              onChange={(e) => setModel(e.target.value)}
                              className="w-full p-2 text-sm border border-blue-300 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                              <option value="gemini-2.5-flash">
                                Gemini 2.5 Flash (Fast)
                              </option>
                              <option value="gemini-1.5-pro">
                                Gemini 1.5 Pro (Thorough)
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Provider
                            </label>
                            <select
                              value={provider}
                              onChange={(e) => setProvider(e.target.value)}
                              className="w-full p-2 text-sm border border-blue-300 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                              <option value="gemini">Google Gemini</option>
                            </select>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                          AI processing will analyze content, extract
                          topics/keywords, and perform quality checks.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Edit Content - Version {selectedVersion.version_num}
                      </h3>
                      <div className="flex items-center gap-3">
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

                    <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                      {selectedArticle.status === "PUBLISHED" ? (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                          <strong>Published Article:</strong> Changes will be
                          saved to database and the published file will be
                          automatically updated.
                        </div>
                      ) : (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <strong>Draft Article:</strong> Changes will be saved
                          to database only. Publish the article to create the
                          file.
                        </div>
                      )}
                    </div>

                    <textarea
                      value={editableContent}
                      onChange={(e) => setEditableContent(e.target.value)}
                      className="w-full h-96 p-4 border border-gray-300 dark:border-gray-600 rounded-lg resize-y font-mono text-sm bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      placeholder="Enter your markdown content here..."
                    />

                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Supports Markdown formatting. Frontmatter will be
                      automatically processed and validated.
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditBlogs;
