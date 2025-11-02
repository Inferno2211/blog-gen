import React, { useState, useEffect } from "react";
import {
  getBacklinkReviewQueue,
  approveBacklink,
  rejectBacklink,
  approveAndPublish,
} from "../services/articlesService";
import { formatDate } from "../utils/dateUtils";
import BlogLayout from "../components/BlogLayout";
import { parseMarkdownWithFrontmatter } from "../utils/markdownParser";

interface BacklinkVersion {
  id: string;
  version_num: number;
  content_md: string;
  backlink_review_status: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  backlink_metadata?: {
    backlink_url: string;
    anchor_text: string;
    original_content_hash: string;
    integration_date: string;
  } | null;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  article: {
    id: string;
    slug: string;
    topic?: string;
    domain: {
      slug: string;
      name: string;
    };
    selected_version?: {
      id: string;
      version_num: number;
    };
  };
}

const BacklinkReview: React.FC = () => {
  const [backlinkQueue, setBacklinkQueue] = useState<BacklinkVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] =
    useState<BacklinkVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "PENDING_REVIEW" | "APPROVED" | "REJECTED"
  >("PENDING_REVIEW");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadBacklinkQueue();
  }, [statusFilter, sortBy, sortOrder]);

  const loadBacklinkQueue = async () => {
    try {
      setLoading(true);
      const response = await getBacklinkReviewQueue(
        statusFilter,
        sortBy,
        sortOrder
      );
      setBacklinkQueue(response);
    } catch (error) {
      console.error("Failed to load backlink queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (versionId: string) => {
    try {
      await approveBacklink(versionId, reviewNotes);
      setReviewNotes("");
      setSelectedVersion(null);
      loadBacklinkQueue();
    } catch (error) {
      console.error("Failed to approve backlink:", error);
    }
  };

  const handleReject = async (versionId: string) => {
    try {
      await rejectBacklink(versionId, reviewNotes);
      setReviewNotes("");
      setSelectedVersion(null);
      loadBacklinkQueue();
    } catch (error) {
      console.error("Failed to reject backlink:", error);
    }
  };

  const handleApproveAndPublish = async (versionId: string) => {
    try {
      await approveAndPublish(versionId, reviewNotes);
      setReviewNotes("");
      setSelectedVersion(null);
      loadBacklinkQueue();
    } catch (error) {
      console.error("Failed to approve and publish:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusColors[status as keyof typeof statusColors]
        }`}
      >
        {status.replace("_", " ")}
      </span>
    );
  };

  const renderContent = (newContent: string, mode: "preview" | "diff") => {
    if (mode === "preview") {
      try {
        // Parse the markdown content to extract frontmatter and content
        const parsed = parseMarkdownWithFrontmatter(newContent);

        return (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-4">Article Preview</h4>
            <div className="border rounded-lg overflow-hidden">
              <BlogLayout
                frontmatter={parsed.frontmatter}
                content={parsed.content}
              />
            </div>
          </div>
        );
      } catch (error) {
        return (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="text-red-700">
              Failed to parse article content for preview. Showing raw content
              instead.
            </p>
            <div className="mt-2 p-2 bg-white rounded border">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {newContent}
              </pre>
            </div>
          </div>
        );
      }
    } else {
      // Diff mode - highlight the backlink
      const lines = newContent.split("\n");
      const backlinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

      return (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Content Changes</h4>
          <div className="space-y-2">
            {lines.map((line, index) => {
              if (backlinkPattern.test(line)) {
                return (
                  <div
                    key={index}
                    className="bg-blue-50 p-2 rounded border-l-4 border-blue-400"
                  >
                    <span className="text-blue-700 font-medium">+ {line}</span>
                  </div>
                );
              }
              return (
                <div key={index} className="text-gray-700">
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Backlink Review Queue
        </h1>
        <p className="text-gray-600">
          Review and approve backlink integrations before publishing
        </p>
      </div>

      {/* Filters and Sorting */}
      <div className="bg-slate-800 rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-100 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-100 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at">Created Date</option>
              <option value="version_num">Version Number</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-100 mb-1">
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Backlink Queue */}
      <div className="bg-slate-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-100">Loading backlink queue...</p>
          </div>
        ) : backlinkQueue.length === 0 ? (
          <div className="p-8 text-center text-gray-100">
            No backlinks found with status: {statusFilter.replace("_", " ")}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {backlinkQueue.map((version) => (
              <div key={version.id} className="p-6 hover:bg-slate-700/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-100">
                        {version.article.topic || version.article.slug}
                      </h3>
                      {getStatusBadge(version.backlink_review_status)}
                      <span className="text-sm text-gray-500">
                        v{version.version_num}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-100">
                          <span className="font-medium">Domain:</span>{" "}
                          {version.article.domain.name}
                        </p>
                        {version.backlink_metadata ? (
                          <>
                            <p className="text-sm text-gray-100">
                              <span className="font-medium">Backlink URL:</span>
                            </p>
                            <a
                              href={version.backlink_metadata.backlink_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm break-all"
                            >
                              {version.backlink_metadata.backlink_url}
                            </a>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Anchor Text:</span>{" "}
                              {version.backlink_metadata.anchor_text}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No backlink metadata available
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Created:</span>{" "}
                          {formatDate(version.created_at)}
                        </p>
                        {version.reviewed_at && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Reviewed:</span>{" "}
                            {formatDate(version.reviewed_at)}
                          </p>
                        )}
                        {version.review_notes && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Notes:</span>{" "}
                            {version.review_notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowDiff(true);
                          setShowPreview(false);
                        }}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        View Changes
                      </button>

                      <button
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowPreview(true);
                          setShowDiff(false);
                        }}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Preview Article
                      </button>

                      {version.backlink_review_status === "PENDING_REVIEW" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedVersion(version);
                              setShowDiff(true);
                              setShowPreview(false);
                            }}
                            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Review
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedVersion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">
                  Review Backlink Integration
                </h2>
                <button
                  onClick={() => {
                    setSelectedVersion(null);
                    setShowDiff(false);
                    setShowPreview(false);
                    setReviewNotes("");
                  }}
                  className="text-gray-400 hover:text-gray-600"
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

              <div className="mb-6">
                <h3 className="font-medium mb-2">
                  Article:{" "}
                  {selectedVersion.article.topic ||
                    selectedVersion.article.slug}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Domain: {selectedVersion.article.domain.name} | Version:{" "}
                  {selectedVersion.version_num}
                </p>

                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Backlink Details
                  </h4>
                  {selectedVersion.backlink_metadata ? (
                    <>
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">URL:</span>{" "}
                        {selectedVersion.backlink_metadata.backlink_url}
                      </p>
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Anchor Text:</span>{" "}
                        {selectedVersion.backlink_metadata.anchor_text}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600 italic">
                      No backlink metadata available
                    </p>
                  )}
                </div>

                {/* View Toggle Buttons */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      setShowDiff(true);
                      setShowPreview(false);
                    }}
                    className={`px-3 py-2 text-sm rounded ${
                      showDiff
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    View Changes
                  </button>
                  <button
                    onClick={() => {
                      setShowPreview(true);
                      setShowDiff(false);
                    }}
                    className={`px-3 py-2 text-sm rounded ${
                      showPreview
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Preview Article
                  </button>
                </div>

                {showDiff && (
                  <div className="mb-4">
                    {renderContent(selectedVersion.content_md, "diff")}
                  </div>
                )}

                {showPreview && (
                  <div className="mb-4">
                    {renderContent(selectedVersion.content_md, "preview")}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Notes (Optional)
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add any notes about this backlink integration..."
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                {selectedVersion.backlink_review_status ===
                  "PENDING_REVIEW" && (
                  <>
                    <button
                      onClick={() => handleReject(selectedVersion.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(selectedVersion.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        handleApproveAndPublish(selectedVersion.id)
                      }
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Approve & Publish
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacklinkReview;
