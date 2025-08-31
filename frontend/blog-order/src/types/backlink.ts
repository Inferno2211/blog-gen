export interface BacklinkIntegrationRequest {
  articleId: string;
  backlinkUrl: string;
  anchorText: string;
  model?: string;
  provider?: string;
}

export interface BacklinkIntegrationResponse {
  success: boolean;
  message: string;
  newVersionId: string;
  versionNum: number;
  previewContent: string;
  backlinkUrl: string;
  anchorText: string;
  timestamp: string;
}