import type { 
  PublicArticle, 
  PurchaseRequest, 
  PurchaseInitiateResponse,
  SessionVerifyResponse,
  PurchaseCompleteResponse,
  OrderStatusResponse,
  ArticleAvailability
} from "../types/purchase";
import { mockArticles, mockArticleAvailability } from "../utils/mockData";

const API_BASE = `http://localhost:5000/api/v1`;
const USE_MOCK_DATA = false; // Set to false when backend is ready

// Get all available articles for browsing (public endpoint)
export async function getBrowseArticles(): Promise<PublicArticle[]> {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return mockArticles;
  }
  
  const res = await fetch(`${API_BASE}/articles/browse`);
  if (!res.ok) throw new Error("Failed to get articles");
  const data = await res.json();
  
  // Backend returns { articles: [...], total: number, timestamp: string }
  const articles = data.articles || [];
  
  // Enhance articles with better previews if needed
  return articles.map((article: any) => ({
    ...article,
    preview: article.preview && article.preview.length > 10 
      ? article.preview 
      : `Learn about ${article.title}. This article covers ${article.keyword || article.niche || 'important topics'} and provides valuable insights.`
  }));
}

// Get article availability status (public endpoint)
export async function getArticleAvailability(articleId: string): Promise<ArticleAvailability> {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockArticleAvailability[articleId as keyof typeof mockArticleAvailability] || { available: true };
  }
  
  const res = await fetch(`${API_BASE}/articles/${articleId}/availability`);
  if (!res.ok) throw new Error("Failed to get article availability");
  return res.json();
}

// Initiate purchase process (public endpoint)
export async function initiatePurchase(purchaseData: PurchaseRequest): Promise<any> {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      success: true,
      data: {
        sessionId: 'mock-session-' + Date.now(),
        magicLinkSent: true
      }
    };
  }
  
  const res = await fetch(`${API_BASE}/purchase/initiate`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(purchaseData),
  });
  
  const data = await res.json();
  
  // Handle both success and error responses
  if (!res.ok) {
    throw new Error(data.message || "Failed to initiate purchase");
  }
  
  return data;
}

// Verify session with magic link token (public endpoint)
export async function verifySession(sessionToken: string): Promise<SessionVerifyResponse> {
  const res = await fetch(`${API_BASE}/purchase/verify-session`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionToken }),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.message || "Failed to verify session");
  }
  
  // Backend returns { success: true, data: { valid: true, stripeCheckoutUrl: "...", ... } }
  // We need to return the data portion with the correct structure
  return {
    valid: data.data?.valid || false,
    stripeCheckoutUrl: data.data?.stripeCheckoutUrl,
    sessionData: data.data?.sessionData
  };
}

// Complete purchase after payment (public endpoint)
export async function completePurchase(sessionId: string, stripeSessionId: string): Promise<PurchaseCompleteResponse> {
  const res = await fetch(`${API_BASE}/purchase/complete`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, stripeSessionId }),
  });
  if (!res.ok) throw new Error("Failed to complete purchase");
  return res.json();
}

// Get order status (public endpoint)
export async function getOrderStatus(orderId: string): Promise<OrderStatusResponse> {
  const res = await fetch(`${API_BASE}/purchase/status/${orderId}`);
  if (!res.ok) throw new Error("Failed to get order status");
  return res.json();
}

// Get article content for preview (public endpoint)
export async function getArticleContent(articleId: string): Promise<string> {
  if (USE_MOCK_DATA) {
    // Return mock content
    await new Promise(resolve => setTimeout(resolve, 800));
    return `# Sample Article Content

This is a sample article content for preview purposes. In a real implementation, this would fetch the actual article content from the backend.

## Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Main Content

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### Subsection

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

## Conclusion

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;
  }
  
  try {
    const res = await fetch(`${API_BASE}/articles/${articleId}/content`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}: Failed to get article content`);
    }
    const data = await res.json();
    return data.content || '';
  } catch (error) {
    console.error('Error fetching article content:', error);
    // Fallback to a generic preview if the article content fails to load
    return `# Article Preview

This article is currently being processed. Please check back later for the full content.

**Note:** This is a preview placeholder. The actual article content will be available once processing is complete.`;
  }
}