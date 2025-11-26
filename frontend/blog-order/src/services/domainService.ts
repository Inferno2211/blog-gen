import type {
  CreateDomainRequest,
  BulkCreateDomainRequest,
  CreateDomainResponse,
  BulkCreateDomainResponse,
  Domain,
} from "../types/domain";
import { getAuthToken } from "./authService";
import { apiBase } from "../utils/api";

const API_BASE = apiBase("domain");

// Helper function to get headers with auth token
const getHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Domain CRUD Operations
export async function createDomain(
  data: CreateDomainRequest
): Promise<CreateDomainResponse> {
  const res = await fetch(`${API_BASE}/createDomain`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to create domain");
  }
  return res.json();
}

export async function bulkCreateDomains(
  data: BulkCreateDomainRequest
): Promise<BulkCreateDomainResponse> {
  const res = await fetch(`${API_BASE}/createDomain`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to create domains");
  }
  return res.json();
}

export async function getDomain(id: string): Promise<Domain> {
  const res = await fetch(`${API_BASE}/getDomain/${id}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get domain");
  }
  return res.json();
}

export async function getAllDomains(): Promise<{
  total: number;
  domains: Domain[];
}> {
  const res = await fetch(`${API_BASE}/getAllDomains`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get domains");
  }
  return res.json();
}

export async function updateDomain(
  id: string,
  data: Partial<CreateDomainRequest>
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/updateDomain/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to update domain");
  }
  return res.json();
}

export async function deleteDomain(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/deleteDomain/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to delete domain");
  }
  return res.json();
}

// Template/Layout Operations
export async function getAvailableTemplates(): Promise<{
  success: boolean;
  templates: string[];
  count: number;
}> {
  const res = await fetch(`${API_BASE}/getAvailableTemplates`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get templates");
  }
  return res.json();
}

export async function createDomainFolder(
  domainName: string
): Promise<{
  success: boolean;
  domainName: string;
  domainPath: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/createDomainFolder`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ domainName }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to create domain folder");
  }
  return res.json();
}

export async function switchDomainTemplate(
  domainName: string,
  newLayoutName: string
): Promise<{
  success: boolean;
  domainName: string;
  newLayoutName: string;
  configPath: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/switchDomainTemplate`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ domainName, newLayoutName }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to switch template");
  }
  return res.json();
}

export async function getDomainLayout(
  domainName: string
): Promise<{ success: boolean; domainName: string; layout: string }> {
  const res = await fetch(`${API_BASE}/getDomainLayout/${domainName}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get domain layout");
  }
  return res.json();
}

export async function listDomains(): Promise<{
  success: boolean;
  domains: Array<{
    domainName: string;
    layout: string;
    lastModified: string;
    configPath: string;
  }>;
  count: number;
}> {
  const res = await fetch(`${API_BASE}/listDomains`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to list domains");
  }
  return res.json();
}

export async function getDomainInfo(
  domainName: string
): Promise<{
  success: boolean;
  domainInfo: {
    domainName: string;
    layout: string;
    lastModified: string;
    configPath: string;
  };
}> {
  const res = await fetch(`${API_BASE}/getDomainInfo/${domainName}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get domain info");
  }
  return res.json();
}

// Blog Operations
export async function addBlogToDomain(
  domainName: string,
  fileName: string,
  content: string
): Promise<{
  success: boolean;
  domainName: string;
  fileName: string;
  filePath: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/addBlogToDomain`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ domainName, fileName, content }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to add blog to domain");
  }
  return res.json();
}

export async function addArticleToDomain(
  articleId: string,
  domainName: string
): Promise<{
  success: boolean;
  filePath: string;
  fileName: string;
  message: string;
  article: any;
}> {
  const res = await fetch(`${API_BASE}/addArticleToDomain`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ articleId, domainName }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to add article to domain");
  }
  return res.json();
}

// Utility Operations
export async function buildDomain(
  domainName: string
): Promise<{
  success: boolean;
  domainName: string;
  message: string;
  installOutput: string;
  buildOutput: string;
}> {
  const res = await fetch(`${API_BASE}/buildDomain/${domainName}`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to build domain");
  }
  return res.json();
}

export async function getDomainStatus(
  domainName: string
): Promise<{
  success: boolean;
  domainName: string;
  status: {
    exists: boolean;
    hasNodeModules: boolean;
    hasDist: boolean;
    postCount: number;
    layout: string;
    lastModified: string;
  };
}> {
  const res = await fetch(`${API_BASE}/getDomainStatus/${domainName}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to get domain status");
  }
  return res.json();
}

export async function downloadDomain(domainName: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/downloadDomain/${domainName}`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to download domain");
  }
  return res.blob();
}
