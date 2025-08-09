import type { Article } from "../types/article";

const API_BASE = `http://localhost:5000/api/v1/articles`;

// Get all articles with versions and domain information
export async function getAllArticles(): Promise<Article[]> {
    const res = await fetch(`${API_BASE}/getAllArticles`);
    if (!res.ok) throw new Error('Failed to get articles');
    return res.json();
}

// Get article by ID
export async function getArticle(id: string): Promise<Article> {
    const res = await fetch(`${API_BASE}/getArticleById/${id}`);
    if (!res.ok) throw new Error('Failed to get article');
    return res.json();
}

// Update article
export async function updateArticle(id: string, data: Partial<Article>): Promise<Article> {
    const res = await fetch(`${API_BASE}/updateArticle/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update article');
    return res.json();
}

// Delete article
export async function deleteArticle(id: string): Promise<Article> {
    const res = await fetch(`${API_BASE}/deleteArticle/${id}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete article');
    return res.json();
}

// Set selected version
export async function setSelectedVersion(articleId: string, versionId: string): Promise<Article> {
    const res = await fetch(`${API_BASE}/setSelectedVersion/${articleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
    });
    if (!res.ok) throw new Error('Failed to set selected version');
    return res.json();
}

// Publish blog
export async function publishBlog(articleId: string): Promise<{ success: boolean; message: string; articleId: string; file: string }> {
    const res = await fetch(`${API_BASE}/publishBlog/${articleId}`, {
        method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to publish blog');
    return res.json();
}

// Select version for article
export async function selectVersion(articleId: string, versionId: string): Promise<Article> {
    const res = await fetch(`${API_BASE}/setSelectedVersion/${articleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
    });
    if (!res.ok) throw new Error('Failed to select version');
    return res.json();
} 