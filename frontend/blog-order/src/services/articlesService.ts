import type { Article } from "../types/article";
import { getAuthToken } from "./authService";

const API_BASE = `http://localhost:5000/api/v1/articles`;

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
