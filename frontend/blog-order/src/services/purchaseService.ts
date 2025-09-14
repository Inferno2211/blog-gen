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
  return data.articles || [];
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
export async function initiatePurchase(purchaseData: PurchaseRequest): Promise<PurchaseInitiateResponse> {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      sessionId: 'mock-session-' + Date.now(),
      magicLinkSent: true
    };
  }
  
  const res = await fetch(`${API_BASE}/purchase/initiate`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(purchaseData),
  });
  if (!res.ok) throw new Error("Failed to initiate purchase");
  return res.json();
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
  if (!res.ok) throw new Error("Failed to verify session");
  return res.json();
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