export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  preview: string;
  availability_status: 'AVAILABLE' | 'SOLD_OUT' | 'PROCESSING';
  domain: string;
  created_at: string;
}

export interface PurchaseRequest {
  articleId: string;
  keyword: string;
  targetUrl: string;
  notes?: string;
  email: string;
}

export interface PurchaseSession {
  id: string;
  email: string;
  article_id: string;
  backlink_data: {
    keyword: string;
    target_url: string;
    notes?: string;
  };
  status: 'PENDING_AUTH' | 'AUTHENTICATED' | 'PAYMENT_PENDING' | 'PAID' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  stripe_session_id?: string;
  magic_link_token: string;
  magic_link_expires: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  session_id: string;
  article_id: string;
  version_id?: string;
  customer_email: string;
  backlink_data: {
    keyword: string;
    target_url: string;
    notes?: string;
  };
  payment_data: {
    stripe_session_id: string;
    amount: number;
    currency: string;
    status: string;
  };
  status: 'PROCESSING' | 'QUALITY_CHECK' | 'ADMIN_REVIEW' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  created_at: string;
  completed_at?: string;
}

export interface ArticleAvailability {
  available: boolean;
  reason?: string;
}

export interface PurchaseInitiateResponse {
  sessionId: string;
  magicLinkSent: boolean;
}

export interface SessionVerifyResponse {
  valid: boolean;
  sessionData?: PurchaseSession;
  stripeCheckoutUrl?: string;
}

export interface PurchaseCompleteResponse {
  orderId: string;
  status: string;
}

export interface OrderStatusResponse {
  status: string;
  progress: string;
  estimatedCompletion?: string;
}