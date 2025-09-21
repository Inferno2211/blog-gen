import type {
  BacklinkIntegrationRequest,
  BacklinkIntegrationResponse,
} from "../types/backlink";
import { getAuthToken } from "./authService";

const API_BASE = `${import.meta.env.VITE_REACT_APP_API_URL}/v${
  import.meta.env.VITE_REACT_APP_API_VERSION
}`;

// Admin backlink integration
export async function integrateBacklink(
  backlinkData: BacklinkIntegrationRequest
): Promise<BacklinkIntegrationResponse> {
  const token = getAuthToken();
  if (!token) throw new Error("No authentication token");

  const res = await fetch(`${API_BASE}/articles/integrateBacklink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(backlinkData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to integrate backlink");
  }

  return res.json();
}

// Customer-specific API calls (no authentication required as they use order ID)

interface CustomerBacklinkRequest {
  orderId: string;
  backlinkUrl: string;
  anchorText: string;
  model?: string;
  provider?: string;
}

interface CustomerBacklinkResponse {
  success: boolean;
  message: string;
  versionId: string;
  versionNum: number;
  content: string;
  previewContent: string;
}

// Customer backlink integration after payment
export async function customerIntegrateBacklink(
  backlinkData: CustomerBacklinkRequest
): Promise<CustomerBacklinkResponse> {
  const res = await fetch(`${API_BASE}/purchase/configure-backlink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(backlinkData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to integrate backlink");
  }

  return res.json();
}

// Regenerate customer backlink content
export async function customerRegenerateBacklink(
  data: CustomerBacklinkRequest & { versionId: string }
): Promise<CustomerBacklinkResponse> {
  const res = await fetch(`${API_BASE}/purchase/regenerate-backlink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to regenerate content");
  }

  return res.json();
}

// Submit customer backlink for admin review
export async function customerSubmitForReview(data: {
  orderId: string;
  versionId: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/purchase/submit-for-review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to submit for review");
  }

  return res.json();
}

// Get order details for customer
export async function getOrderDetails(orderId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/purchase/order/${orderId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to load order details");
  }

  return res.json();
}
