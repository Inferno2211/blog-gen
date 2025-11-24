import type { Article } from "../types/article";
import { getAuthToken } from "./authService";

const API_HOST =
  import.meta.env.VITE_REACT_APP_API_URL?.replace(/\/$/, "") ||
  (typeof window !== "undefined" ? window.location.origin : "");
const API_VERSION = import.meta.env.VITE_REACT_APP_API_VERSION || "1";
const API_BASE = `${API_HOST}/v${API_VERSION}/articles`;

// Helper function to get headers with auth token
const getHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Get all articles with versions and domain information
export async function getAllArticles(): Promise<Article[]> {
  const res = await fetch(`${API_BASE}/getAllArticles`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to get articles");
  return res.json();
}

// Get article by ID
export async function getArticle(id: string): Promise<Article> {
  const res = await fetch(`${API_BASE}/getArticleById/${id}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to get article");
  return res.json();
}

// Update article
export async function updateArticle(
  id: string,
  data: Partial<Article>
): Promise<Article> {
  const res = await fetch(`${API_BASE}/updateArticle/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update article");
  return res.json();
}

// Delete article
export async function deleteArticle(id: string): Promise<Article> {
  const res = await fetch(`${API_BASE}/deleteArticle/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete article");
  return res.json();
}

// Set selected version
export async function setSelectedVersion(
  articleId: string,
  versionId: string
): Promise<Article> {
  const res = await fetch(`${API_BASE}/setSelectedVersion/${articleId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ versionId }),
  });
  if (!res.ok) throw new Error("Failed to set selected version");
  return res.json();
}

// Publish blog
export async function publishBlog(
  articleId: string
): Promise<{
  success: boolean;
  message: string;
  articleId: string;
  file: string;
}> {
  const res = await fetch(`${API_BASE}/publishBlog/${articleId}`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to publish blog");
  return res.json();
}

// Select version for article
export async function selectVersion(
  articleId: string,
  versionId: string
): Promise<Article> {
  const res = await fetch(`${API_BASE}/setSelectedVersion/${articleId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ versionId }),
  });
  if (!res.ok) throw new Error("Failed to select version");
  return res.json();
}

// Backlink review workflow methods
export async function getBacklinkReviewQueue(
  status: string = 'PENDING_REVIEW',
  sortBy: string = 'created_at',
  sortOrder: string = 'desc'
): Promise<any[]> {
  const params = new URLSearchParams({
    status,
    sortBy,
    sortOrder
  });
  
  const res = await fetch(`${API_BASE}/backlinkReviewQueue?${params}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to get backlink review queue");
  return res.json();
}

export async function approveBacklink(
  versionId: string,
  reviewNotes?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/approveBacklink/${versionId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ reviewNotes }),
  });
  if (!res.ok) throw new Error("Failed to approve backlink");
  return res.json();
}

export async function rejectBacklink(
  versionId: string,
  reviewNotes?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/rejectBacklink/${versionId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ reviewNotes }),
  });
  if (!res.ok) throw new Error("Failed to reject backlink");
  return res.json();
}

export async function approveAndPublish(
  versionId: string,
  reviewNotes?: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/approveAndPublish/${versionId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ reviewNotes }),
  });
  if (!res.ok) throw new Error("Failed to approve and publish");
  return res.json();
}

// Edit article content (handles both published and unpublished articles)
export async function editArticleContent(
  articleId: string,
  content_md: string,
  useAI: boolean = false,
  model?: string,
  provider?: string
): Promise<{
  success: boolean;
  message: string;
  articleId: string;
  versionId: string;
  versionNum: number;
  content: string;
  qcResult: any;
  status: string;
  fileUpdated: boolean;
  filePath?: string;
  fileName?: string;
  editMethod: "AI_PROCESSED" | "DIRECT_EDIT";
}> {
  const res = await fetch(`${API_BASE}/editArticleContent/${articleId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({
      content_md,
      useAI,
      model: model || "gemini-2.5-flash",
      provider: provider || "gemini",
    }),
  });
  if (!res.ok) throw new Error("Failed to edit article content");
  return res.json();
}

// Direct edit article content (no AI processing - faster)
export async function editArticleContentDirect(
  articleId: string,
  content_md: string
): Promise<{
  success: boolean;
  message: string;
  articleId: string;
  versionId: string;
  versionNum: number;
  content: string;
  qcResult: any;
  status: string;
  fileUpdated: boolean;
  filePath?: string;
  fileName?: string;
  editMethod: "DIRECT_EDIT";
}> {
  const res = await fetch(`${API_BASE}/editArticleContentDirect/${articleId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ content_md }),
  });
  if (!res.ok) throw new Error("Failed to edit article content");
  return res.json();
}
