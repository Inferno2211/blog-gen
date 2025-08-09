import type { GenerateBlogRequest, BlogApiResponse, GenerateVersionRequest } from '../types/blog';

const API_BASE = `${import.meta.env.VITE_REACT_APP_API_URL}/v${import.meta.env.VITE_REACT_APP_API_VERSION}/ai`;

export async function generateBlog(data: GenerateBlogRequest): Promise<BlogApiResponse> {
    const res = await fetch(`${API_BASE}/generateArticle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to generate blog');
    return res.json();
}

export async function generateBlogVersion(data: GenerateVersionRequest): Promise<BlogApiResponse> {
    const res = await fetch(`${API_BASE}/generateArticleVersion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to generate blog version');
    return res.json();
}

export async function setSelectedVersion(articleId: string, versionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/setSelectedVersion/${articleId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
    });
    if (!res.ok) throw new Error('Failed to set selected version');
    return res.json();
}
