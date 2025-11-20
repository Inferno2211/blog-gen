export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  preview: string;
  availability_status: "AVAILABLE" | "SOLD_OUT" | "PROCESSING";
  domain: string;
  domainData?: {
    id: string;
    name: string;
    slug: string;
    tags?: string;
    categories?: string;
    domain_age?: number;
    domain_rating?: number;
  };
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
  status:
    | "PENDING_AUTH"
    | "AUTHENTICATED"
    | "PAYMENT_PENDING"
    | "PAID"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED";
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
  status:
    | "PROCESSING"
    | "QUALITY_CHECK"
    | "ADMIN_REVIEW"
    | "COMPLETED"
    | "FAILED"
    | "REFUNDED";
  scheduled_publish_at?: string;
  scheduled_status?: "SCHEDULED" | "CANCELLED" | "PUBLISHED" | "FAILED";
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
  sessionData?: PurchaseSession & {
    sessionId?: string;
    orderId?: string;
  };
  stripeCheckoutUrl?: string;
  alreadyPaid?: boolean;
  orderId?: string;
  orderType?: string;
  error?: string;
}

export interface PurchaseCompleteResponse {
  success: boolean;
  message: string;
  data: {
    orderId?: string;
    status?: string;
    // Bulk purchase fields
    sessionId?: string;
    orderCount?: number;
    orders?: Array<{
      orderId: string;
      articleId: string;
      status: string;
    }>;
  };
}

export interface OrderStatusResponse {
  order: Order;
  progress: {
    status: string;
    message: string;
    currentStage: string;
    stages: {
      name: string;
      status: "completed" | "in-progress" | "pending";
      timestamp?: string;
    }[];
  };
  queueStatus?: {
    queue: string;
    state: string;
    progress?: number;
    timestamp: string;
  };
  content?: {
    contentMd: string;
    title: string;
    preview?: string;
  };
  regenerationCount?: number;
}

// Backend API response structure (actual response from API)
export interface BackendOrderStatusResponse {
  success: boolean;
  message: string;
  data: {
    status: string;
    statusMessage: string;
    progress: {
      step: number;
      total: number;
      description: string;
    };
    orderDetails: {
      orderId: string;
      articleId: string;
      articleSlug?: string;
      domainName?: string;
      backlinkData: {
        keyword: string;
        target_url: string;
        notes?: string;
      };
      createdAt: string;
      completedAt?: string;
      customerEmail: string;
    };
    version?: {
      versionId: string;
      versionNum: number;
      content: string;
      qcStatus: string;
      backlinkReviewStatus: string;
    } | null;
    queue: {
      hasActiveJob: boolean;
      hasFailedJob: boolean;
      jobs: Array<{
        queue: string;
        state: string;
        progress?: number;
      }>;
    };
    canRequestRevision: boolean;
    canSubmitForReview: boolean;
  };
}

// Scheduling interfaces
export interface SchedulePublicationRequest {
  orderId: string;
  versionId: string;
  scheduledPublishAt: string; // ISO 8601 string in UTC
  scheduledBy?: string;
}

export interface SchedulePublicationResponse {
  success: boolean;
  message: string;
  versionId: string;
  orderId: string;
  scheduledPublishAt: string;
  jobId: string;
}

export interface CancelScheduleRequest {
  orderId: string;
  versionId: string;
}

export interface CancelScheduleResponse {
  success: boolean;
  message: string;
  versionId: string;
  orderId: string;
}

export interface ReschedulePublicationRequest {
  orderId: string;
  versionId: string;
  scheduledPublishAt: string; // ISO 8601 string in UTC
  scheduledBy?: string;
}

export interface ReschedulePublicationResponse {
  success: boolean;
  message: string;
  versionId: string;
  orderId: string;
  scheduledPublishAt: string;
  jobId: string;
}
