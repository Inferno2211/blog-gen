import type {
  GenerateBlogRequest,
  BlogApiResponse,
  GenerateVersionRequest,
} from "../types/blog";
import { getAuthToken } from "./authService";
import { apiBase } from "../utils/api";

const API_BASE = apiBase("ai");

// Helper function to get headers with auth token
const getHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export async function generateBlog(
  data: GenerateBlogRequest
): Promise<BlogApiResponse> {
  const res = await fetch(`${API_BASE}/generateArticle`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to generate blog");
  return res.json();
}

export async function generateBlogVersion(
  data: GenerateVersionRequest
): Promise<BlogApiResponse> {
  const res = await fetch(`${API_BASE}/generateArticleVersion`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to generate blog version");
  return res.json();
}

export async function setSelectedVersion(
  articleId: string,
  versionId: string
): Promise<any> {
  const res = await fetch(`${API_BASE}/setSelectedVersion/${articleId}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ versionId }),
  });
  if (!res.ok) throw new Error("Failed to set selected version");
  return res.json();
}
