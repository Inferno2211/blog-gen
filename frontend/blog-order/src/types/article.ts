export interface Domain {
  id: string;
  slug: string;
  name: string;
  url: string;
  tags: string;
  created_at: string;
}

export interface ArticleVersion {
  id: string;
  article_id: string;
  version_num: number;
  content_md: string;
  qc_attempts: number;
  last_qc_status: string | null;
  last_qc_notes: any | null;
  created_at: string;
  prompt: string | null;
}

export interface Article {
  id: string;
  domain_id: string | null;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  baclink_expiry: string | null;
  user: string | null;
  topic: string | null;
  niche: string | null;
  keyword: string | null;
  backlink_target: string | null;
  anchor: string | null;
  selected_version_id: string | null;
  domain: Domain | null;
  versions: ArticleVersion[];
}

export interface UpdateArticleRequest {
  status?: string;
  user?: string;
  topic?: string;
  niche?: string;
  keyword?: string;
  backlink_target?: string;
  anchor?: string;
}

export interface SetSelectedVersionRequest {
  versionId: string;
}

export interface PublishBlogResponse {
  success: boolean;
  message: string;
  articleId: string;
  file: string;
} 