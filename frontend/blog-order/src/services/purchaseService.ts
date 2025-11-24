import type {
  PublicArticle,
  PurchaseRequest,
  PurchaseInitiateResponse,
  SessionVerifyResponse,
  PurchaseCompleteResponse,
  BackendOrderStatusResponse,
  ArticleAvailability,
} from "../types/purchase";
import type { Domain } from "../types/domain";
import { mockArticles, mockArticleAvailability } from "../utils/mockData";

const normalizeBaseUrl = (url?: string) => {
  if (!url) {
    return typeof window !== "undefined" ? window.location.origin : "";
  }
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
};

const API_HOST = normalizeBaseUrl(import.meta.env.VITE_REACT_APP_API_URL);
const API_VERSION = import.meta.env.VITE_REACT_APP_API_VERSION || "1";
const API_BASE = `${API_HOST}/v${API_VERSION}`;
const USE_MOCK_DATA = false; // Set to false when backend is ready

// Get all available articles for browsing (public endpoint)
export async function getBrowseArticles(): Promise<PublicArticle[]> {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
    preview:
      article.preview && article.preview.length > 10
        ? article.preview
        : `Learn about ${article.title}. This article covers ${article.keyword || article.niche || "important topics"
        } and provides valuable insights.`,
  }));
}

// Get article availability status (public endpoint)
export async function getArticleAvailability(
  articleId: string
): Promise<ArticleAvailability> {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    return (
      mockArticleAvailability[
      articleId as keyof typeof mockArticleAvailability
      ] || { available: true }
    );
  }

  const res = await fetch(`${API_BASE}/articles/${articleId}/availability`);
  if (!res.ok) throw new Error("Failed to get article availability");
  return res.json();
}

// Initiate purchase process (public endpoint)
export async function initiatePurchase(
  purchaseData: PurchaseRequest
): Promise<any> {
  if (USE_MOCK_DATA) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      success: true,
      data: {
        sessionId: "mock-session-" + Date.now(),
        magicLinkSent: true,
      },
    };
  }

  const res = await fetch(`${API_BASE}/purchase/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
export async function verifySession(
  sessionToken: string
): Promise<SessionVerifyResponse> {
  const res = await fetch(`${API_BASE}/purchase/verify-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionToken }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Failed to verify session");
  }

  // Backend returns { success: true, data: { valid: true, stripeCheckoutUrl: "...", alreadyPaid: true, orderId: "...", orderType: "...", ... } }
  // We need to return the data portion with the correct structure
  return {
    valid: data.data?.valid || false,
    stripeCheckoutUrl: data.data?.stripeCheckoutUrl,
    sessionData: data.data?.sessionData,
    alreadyPaid: data.data?.alreadyPaid,
    orderId: data.data?.orderId,
    orderType: data.data?.orderType,
    error: data.message,
  };
}

// Complete purchase after payment (public endpoint)
export async function completePurchase(
  sessionId: string,
  stripeSessionId: string
): Promise<PurchaseCompleteResponse> {
  const res = await fetch(`${API_BASE}/purchase/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, stripeSessionId }),
  });
  if (!res.ok) throw new Error("Failed to complete purchase");
  return res.json();
}

// Get order status (public endpoint)
export async function getOrderStatus(
  orderId: string
): Promise<BackendOrderStatusResponse> {
  // Use no-cache to avoid connection reuse issues
  const res = await fetch(`${API_BASE}/purchase/status/${orderId}`, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "close",
    },
  });
  if (!res.ok) throw new Error("Failed to get order status");
  return res.json();
}

// Get article content for preview (public endpoint)
export async function getArticleContent(articleId: string): Promise<string> {
  if (USE_MOCK_DATA) {
    // Return mock content
    await new Promise((resolve) => setTimeout(resolve, 800));
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
      throw new Error(
        errorData.error || `HTTP ${res.status}: Failed to get article content`
      );
    }
    const data = await res.json();
    return data.content || "";
  } catch (error) {
    console.error("Error fetching article content:", error);
    // Fallback to a generic preview if the article content fails to load
    return `# Article Preview

This article is currently being processed. Please check back later for the full content.

**Note:** This is a preview placeholder. The actual article content will be available once processing is complete.`;
  }
}

// Get all available domains for article requests (public endpoint)
export async function getBrowseDomains(): Promise<Domain[]> {
  const res = await fetch(`${API_BASE}/domain/browse`);
  if (!res.ok) throw new Error("Failed to get domains");
  const data = await res.json();
  return data.domains || [];
}

// Initiate article purchase for a domain
export async function initiateArticlePurchase(request: {
  domainId: string;
  articleTitle: string;
  topic: string;
  niche?: string;
  keyword?: string;
  targetUrl?: string; // Optional backlink
  anchorText?: string; // Optional backlink anchor text
  email: string;
  notes?: string;
}): Promise<PurchaseInitiateResponse> {
  const res = await fetch(`${API_BASE}/purchase/initiate-article`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...request,
      type: "ARTICLE_GENERATION", // Distinguish from backlink orders
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to initiate article purchase");
  }

  return res.json();
}

// Get order details for customer configuration
export async function getOrderDetails(
  orderId: string
): Promise<{ order: any }> {
  const res = await fetch(`${API_BASE}/purchase/order/${orderId}`);
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to get order details");
  }
  return res.json();
}

// Customer article generation
export async function customerConfigureArticle(articleData: {
  orderId: string;
  title: string;
  niche?: string;
  keyword?: string;
  topic: string;
  targetURL?: string;
  anchorText?: string;
  model?: string;
  provider?: string;
}): Promise<{
  versionId: string;
  versionNum: number;
  content: string;
  previewContent: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/configure-article`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(articleData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to generate article");
  }

  return res.json();
}

// Regenerate customer article
export async function customerRegenerateArticle(data: {
  orderId: string;
  versionId: string;
  title: string;
  niche?: string;
  keyword?: string;
  topic: string;
  targetURL?: string;
  anchorText?: string;
  model?: string;
  provider?: string;
}): Promise<{
  versionId: string;
  versionNum: number;
  content: string;
  previewContent: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/regenerate-article`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to regenerate article");
  }

  return res.json();
}

// Submit article for admin review
export async function customerSubmitArticleForReview(data: {
  orderId: string;
  versionId: string;
  scheduledPublishAt?: string; // ISO 8601 UTC string
}): Promise<{ reviewId: string; scheduledPublish?: string }> {
  const res = await fetch(`${API_BASE}/purchase/submit-for-review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to submit for review");
  }

  return res.json();
}

// Customer backlink integration (compatible with existing CustomerBacklinkConfiguration)
export async function customerIntegrateBacklink(backlinkData: {
  orderId: string;
  backlinkUrl: string;
  anchorText: string;
  model?: string;
  provider?: string;
}): Promise<{
  success: boolean;
  message: string;
  versionId: string;
  versionNum: number;
  content: string;
  previewContent: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/configure-backlink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(backlinkData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to integrate backlink");
  }

  return res.json();
}

// Regenerate customer backlink content
export async function customerRegenerateBacklink(data: {
  orderId: string;
  versionId: string;
  backlinkUrl: string;
  anchorText: string;
  model?: string;
  provider?: string;
}): Promise<{
  success: boolean;
  message: string;
  versionId: string;
  versionNum: number;
  content: string;
  previewContent: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/regenerate-backlink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to regenerate content");
  }

  return res.json();
}

// Submit customer backlink for admin review (compatible with CustomerBacklinkConfiguration)
export async function customerSubmitForReview(data: {
  orderId: string;
  versionId: string;
  scheduledPublishAt?: string; // ISO 8601 UTC string
}): Promise<{ success: boolean; message: string; scheduledPublish?: string }> {
  const res = await fetch(`${API_BASE}/purchase/submit-for-review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to submit for review");
  }

  return res.json();
}

// Regenerate backlink integration (customer can regenerate unlimited times)
export async function regenerateBacklink(orderId: string): Promise<{
  success: boolean;
  message: string;
  versionId?: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/regenerate-backlink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to regenerate backlink");
  }

  return res.json();
}

// ============================================
// BULK PURCHASE API CALLS
// ============================================

export interface BulkPurchaseRequest {
  cartItems: Array<{
    articleId: string;
    backlinkData: {
      keyword: string;
      targetUrl: string;
      notes?: string;
    };
  }>;
  email: string;
}

export interface BulkPurchaseResponse {
  sessionId: string;
  magicLinkSent: boolean;
  articleCount: number;
}

export interface CartDetailsResponse {
  session: {
    id: string;
    email: string;
    purchase_type: string;
    cart_items: Array<{
      articleId: string;
      backlinkData: {
        keyword: string;
        targetUrl: string;
        notes?: string;
      };
    }>;
    status: string;
  };
  articles: Array<{
    id: string;
    title: string;
    domain: string;
    preview?: string;
  }>;
  pricing: {
    itemCount: number;
    pricePerItem: number;
    total: number;
    currency: string;
  };
}

export interface BulkOrderStatusResponse {
  session: {
    id: string;
    email: string;
    purchase_type: string;
    status: string;
    created_at: string;
  };
  orders: Array<{
    id: string;
    article_id: string;
    status: string;
    created_at: string;
    completed_at?: string;
    scheduled_publish_at?: string;
    scheduled_status?: "SCHEDULED" | "CANCELLED" | "PUBLISHED" | "FAILED";
    article?: {
      id: string;
      title: string;
      domain: string;
    };
    backlink_data?: {
      keyword: string;
      target_url: string;
    };
  }>;
  statistics: {
    total: number;
    processing: number;
    quality_check: number;
    admin_review: number;
    completed: number;
    failed: number;
    scheduled?: number;
  };
}

// Initiate bulk purchase with cart items
export async function initiateBulkPurchase(
  data: BulkPurchaseRequest
): Promise<BulkPurchaseResponse> {
  const res = await fetch(`${API_BASE}/purchase/initiate-bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to initiate bulk purchase");
  }

  return res.json();
}

// Get cart details with article information and pricing
export async function getCartDetails(
  sessionId: string
): Promise<CartDetailsResponse> {
  const res = await fetch(`${API_BASE}/purchase/cart/${sessionId}`);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to get cart details");
  }

  return res.json();
}

// Get status of all orders in a bulk purchase
export async function getBulkOrderStatus(
  sessionId: string
): Promise<BulkOrderStatusResponse> {
  const res = await fetch(`${API_BASE}/purchase/bulk-status/${sessionId}`);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to get bulk order status");
  }

  const response = await res.json();

  // Backend wraps response in { success, data } format
  if (response.success && response.data) {
    return response.data;
  }

  // Fallback for direct response (backward compatibility)
  return response;
}

// =============================================================================
// SCHEDULED PUBLISHING FUNCTIONS
// =============================================================================

/**
 * Schedule an article version for future publish
 * @param orderId - The order ID
 * @param versionId - The version ID to schedule
 * @param scheduledPublishAt - Date object (will be converted to UTC ISO string)
 */
export async function schedulePublication(data: {
  orderId: string;
  versionId: string;
  scheduledPublishAt: Date;
}): Promise<{
  success: boolean;
  message: string;
  scheduledPublishAt: string;
  jobId: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: data.orderId,
      versionId: data.versionId,
      scheduledPublishAt: data.scheduledPublishAt.toISOString(), // Convert to UTC
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to schedule publication");
  }

  return res.json();
}

/**
 * Cancel scheduled publish for an article version
 * @param orderId - The order ID
 * @param versionId - The version ID
 */
export async function cancelScheduledPublication(data: {
  orderId: string;
  versionId: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/schedule/${data.orderId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      versionId: data.versionId,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to cancel schedule");
  }

  return res.json();
}

/**
 * Reschedule an article version for different publish time
 * @param orderId - The order ID
 * @param versionId - The version ID
 * @param newScheduledPublishAt - New date object (will be converted to UTC ISO string)
 */
export async function reschedulePublication(data: {
  orderId: string;
  versionId: string;
  scheduledPublishAt: Date;
}): Promise<{
  success: boolean;
  message: string;
  scheduledPublishAt: string;
  jobId: string;
}> {
  const res = await fetch(`${API_BASE}/purchase/schedule/${data.orderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      versionId: data.versionId,
      scheduledPublishAt: data.scheduledPublishAt.toISOString(), // Convert to UTC
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to reschedule publication");
  }

  return res.json();
}
