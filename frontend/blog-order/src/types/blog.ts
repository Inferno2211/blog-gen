export interface BlogVersion {
    versionId: string;
    versionNum: number;
    content: string;
    qcResult: {
        summary: string;
        status: string;
        recommendations: string[];
        issues: string[];
        flags: {
            ai_detectable: boolean;
            has_sensitive_content: boolean;
            missing_backlink: boolean;
            spam_signals: boolean;
        };
    };
}

export interface QcResult {
    summary: string;
    status: string;
    recommendations: string[];
    issues: string[];
    flags: {
        ai_detectable: boolean;
        has_sensitive_content: boolean;
        missing_backlink: boolean;
        spam_signals: boolean;
    };
}

export interface BlogApiResponse {
    articleId: string;
    //   versions: BlogVersion[];
    draft: BlogVersion;
    status: string;
}

export interface GenerateBlogRequest {
    domain_id: string;
    user: string;
    niche: string;
    keyword: string;
    topic: string;
    n: number;
    targetURL: string;
    anchorText: string;
    model: string;
    provider: string;
    userPrompt?: string;
}

export interface GenerateVersionRequest {
    articleId: string;
    provider: string;
}
