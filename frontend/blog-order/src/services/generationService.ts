import axios from "axios";
import { apiBase } from "../utils/api";

const BASE_URL = apiBase("generation");

export interface GenerationRequest {
  domainId: string;
  topic: string;
  niche?: string;
  keyword?: string;
  targetUrl: string;
  anchorText: string;
  notes?: string;
}

export interface BulkGenerationResponse {
  success: boolean;
  sessionId: string;
  message: string;
  articleCount: number;
}

export interface VerifyAndPayResponse {
  success: boolean;
  checkoutUrl: string;
  sessionId: string;
  articleCount: number;
  totalPrice: number;
  alreadyPaid?: boolean;
  redirectUrl?: string;
}

export interface GenerationCartResponse {
  success: boolean;
  session: {
    id: string;
    email: string;
    status: string;
    created_at: string;
    generation_requests: Array<{
      domainId: string;
      topic: string;
      niche?: string;
      keyword?: string;
      targetUrl: string;
      anchorText: string;
      notes?: string;
    }>;
  };
  articleCount: number;
  totalPrice: number;
}

export interface BulkGenerationStatusResponse {
  success: boolean;
  session: {
    id: string;
    email: string;
    status: string;
    created_at: string;
  };
  orders: Array<{
    id: string;
    status: string;
    created_at: string;
    completed_at?: string;
    article?: {
      id: string;
      slug: string;
      status: string;
      domain: {
        id: string;
        name: string;
        slug: string;
      };
      selected_version?: {
        id: string;
        title: string;
        last_qc_status: string;
        backlink_review_status?: string;
      };
    };
    backlink_data: {
      topic: string;
      niche?: string;
      keyword?: string;
      targetUrl: string;
      anchorText: string;
      notes?: string;
    };
  }>;
  totalOrders: number;
}

class GenerationService {
  /**
   * Initiate bulk article generation
   */
  async initiateBulkGeneration(
    requests: GenerationRequest[],
    email: string
  ): Promise<BulkGenerationResponse> {
    const response = await axios.post(`${BASE_URL}/initiate-bulk`, {
      generationRequests: requests,
      email,
    });
    return response.data;
  }

  /**
   * Get generation cart details
   */
  async getGenerationCart(sessionId: string): Promise<GenerationCartResponse> {
    const response = await axios.get(`${BASE_URL}/cart/${sessionId}`);
    return response.data;
  }

  /**
   * Verify magic link and get Stripe checkout URL
   */
  async verifyAndPay(token: string): Promise<VerifyAndPayResponse> {
    const response = await axios.post(`${BASE_URL}/verify-and-pay`, {
      token,
    });
    return response.data;
  }

  /**
   * Get bulk generation status
   */
  async getBulkGenerationStatus(
    sessionId: string
  ): Promise<BulkGenerationStatusResponse> {
    const response = await axios.get(`${BASE_URL}/bulk-status/${sessionId}`);
    return response.data;
  }
}

export const generationService = new GenerationService();
