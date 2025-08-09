export interface Domain {
  id: string;
  name: string;
  slug: string;
  url: string;
  tags: string;
  created_at?: string;
  articles?: any[];
  articleCount?: number;
}

export interface CreateDomainRequest {
  name: string;
  slug: string;
  url?: string;
  tags?: string;
  template?: string;
}

export interface BulkCreateDomainRequest {
  domains: string[];
  tags?: string;
  template?: string;
}

export interface CreateDomainResponse {
  success: boolean;
  id?: string;
  slug?: string;
  error?: string;
}

export interface BulkCreateDomainResponse {
  results: Array<{
    domain: string;
    success: boolean;
    id?: string;
    error?: string;
  }>;
}

export interface DomainInfo {
  domainName: string;
  layout: string;
  lastModified: string;
  configPath: string;
}

export interface DomainStatus {
  exists: boolean;
  hasNodeModules: boolean;
  hasDist: boolean;
  postCount: number;
  layout: string;
  lastModified: string;
}

export interface TemplateResponse {
  success: boolean;
  templates: string[];
  count: number;
}

export interface DomainListResponse {
  success: boolean;
  domains: DomainInfo[];
  count: number;
} 