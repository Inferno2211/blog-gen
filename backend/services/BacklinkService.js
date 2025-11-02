const { callAI } = require('./llm/aiCaller');
const { getArticle } = require('./articles/dbCrud');
const { fixFrontmatterStructure } = require('../utils/markdownUtils');
const { insertImages } = require('../utils/insertImages');
const prisma = require('../db/prisma');

/**
 * BacklinkService - Handles AI-powered content regeneration with integrated backlinks
 * Creates new article versions without changing publication status
 */
class BacklinkService {
    /**
     * Integrate a backlink into an existing article's content
     * @param {string} articleId - The article's ID
     * @param {string} backlinkUrl - The URL to link to
     * @param {string} anchorText - The anchor text for the link
     * @param {Object} options - { model?, provider? }
     * @returns {Promise<{versionId: string, versionNum: number, content: string, previewContent: string}>}
     */
    async integrateBacklink(articleId, backlinkUrl, anchorText, options = {}) {
        // Validate inputs
        if (!articleId) {
            throw new Error('Article ID is required');
        }
        if (!backlinkUrl) {
            throw new Error('Backlink URL is required');
        }
        if (!anchorText) {
            throw new Error('Anchor text is required');
        }

        // Validate URL format
        if (!this._isValidUrl(backlinkUrl)) {
            throw new Error('Invalid backlink URL format');
        }

        // Get the article and its current content
        const article = await getArticle(articleId);
        if (!article) {
            throw new Error('Article not found');
        }

        // Get the selected version or latest version content
        let originalContent;
        if (article.selected_version_id) {
            const selectedVersion = article.versions.find(v => v.id === article.selected_version_id);
            if (!selectedVersion) {
                throw new Error('Selected version not found');
            }
            originalContent = selectedVersion.content_md;
        } else if (article.versions && article.versions.length > 0) {
            // Use the latest version if no selected version
            const latestVersion = article.versions.reduce((latest, current) => 
                current.version_num > latest.version_num ? current : latest
            );
            originalContent = latestVersion.content_md;
        } else {
            throw new Error('Article has no content versions');
        }

        // Generate new content with integrated backlink
        let newContent = await this.generateContentWithBacklink(
            originalContent, 
            backlinkUrl, 
            anchorText, 
            options
        );

        // Run QC with regeneration if enabled
        if (options.runQualityCheck) {
            newContent = await this.applyQualityCheckWithRegeneration(
                originalContent,
                newContent,
                backlinkUrl,
                anchorText,
                options
            );
        }

        // Create new article version
        const result = await this.createNewArticleVersion(articleId, newContent, backlinkUrl, anchorText, originalContent);

        // Generate preview content (first 500 characters of body content)
        const previewContent = this._generatePreviewContent(newContent);

        return {
            versionId: result.versionId,
            versionNum: result.versionNum,
            content: newContent,
            previewContent
        };
    }

    /**
     * Generate new content with naturally integrated backlink using AI
     * @param {string} originalContent - The original article content
     * @param {string} backlinkUrl - The URL to integrate
     * @param {string} anchorText - The anchor text to use
     * @param {Object} options - { model?, provider? }
     * @returns {Promise<string>} - The new content with integrated backlink
     */
    async generateContentWithBacklink(originalContent, backlinkUrl, anchorText, options = {}) {
        const model = options.model || 'gemini-2.5-flash';
        const provider = options.provider || 'gemini';

        const prompt = this._buildBacklinkIntegrationPrompt(originalContent, backlinkUrl, anchorText, options.qcFeedback);

        try {
            const response = await callAI(prompt, { provider, modelName: model });
            return fixFrontmatterStructure(response);
        } catch (error) {
            throw new Error(`Failed to generate content with backlink: ${error.message}`);
        }
    }

    /**
     * Create a new article version with the updated content
     * @param {string} articleId - The article's ID
     * @param {string} newContent - The new content with integrated backlink
     * @returns {Promise<{versionId: string, versionNum: number}>}
     */
    async createNewArticleVersion(articleId, newContent, backlinkUrl, anchorText, originalContent) {
        try {
            // Get current article to determine next version number
            const article = await getArticle(articleId);
            if (!article) {
                throw new Error('Article not found');
            }

            // Process images in the content
            console.log('Processing images in backlink-integrated content...');
            let contentWithImages;
            try {
                contentWithImages = await insertImages(newContent);
                console.log('Images processed successfully');
            } catch (imageError) {
                console.warn('Image processing failed, using original content:', imageError.message);
                contentWithImages = newContent;
            }

            // Calculate next version number
            const nextVersionNum = Math.max(...(article.versions?.map(v => v.version_num) || [0])) + 1;

            // Generate hash of original content for diff comparison
            const crypto = require('crypto');
            const originalContentHash = crypto.createHash('md5').update(originalContent).digest('hex');

            // Create new version with backlink review flag
            const newVersion = await prisma.articleVersion.create({
                data: {
                    article_id: articleId,
                    version_num: nextVersionNum,
                    content_md: contentWithImages,
                    qc_attempts: 0,
                    last_qc_status: 'BACKLINK_INTEGRATION',
                    last_qc_notes: { 
                        message: 'Content regenerated with backlink integration - pending admin review',
                        type: 'backlink_integration'
                    },
                    prompt: 'BACKLINK_INTEGRATION',
                    backlink_review_status: 'PENDING_REVIEW',
                    backlink_metadata: {
                        backlink_url: backlinkUrl,
                        anchor_text: anchorText,
                        original_content_hash: originalContentHash,
                        integration_date: new Date().toISOString()
                    }
                }
            });

            return {
                versionId: newVersion.id,
                versionNum: newVersion.version_num
            };
        } catch (error) {
            throw new Error(`Failed to create new article version: ${error.message}`);
        }
    }

    /**
     * Build the AI prompt for backlink integration
     * @param {string} originalContent - The original article content
     * @param {string} backlinkUrl - The URL to integrate
     * @param {string} anchorText - The anchor text to use
     * @returns {string} - The formatted prompt
     */
    _buildBacklinkIntegrationPrompt(originalContent, backlinkUrl, anchorText, qcFeedback = null) {
        let prompt = `You are an expert content editor. Your task is to naturally integrate a NEW backlink into the existing article content while maintaining the article's quality, flow, and readability.

ORIGINAL ARTICLE CONTENT:
${originalContent}

NEW BACKLINK TO INTEGRATE:
- URL: ${backlinkUrl}
- Anchor Text: ${anchorText}

CRITICAL INSTRUCTIONS:
1. The original article already contains existing backlinks and internal links - **DO NOT REMOVE OR MODIFY THEM**
2. Your ONLY task is to ADD the new backlink with the anchor text "${anchorText}" pointing to ${backlinkUrl}
3. Find the most natural place in the content to integrate this NEW backlink
4. The new backlink should be contextually relevant and add value to the reader
5. The link should flow naturally within a sentence or paragraph
6. **PRESERVE ALL EXISTING LINKS** - both external backlinks and internal links
7. Preserve all existing frontmatter exactly as it is
8. Maintain the article's original structure, tone, and main message
9. Ensure the integration feels organic and not forced

REQUIREMENTS:
- Keep the same frontmatter structure
- Maintain the article's original style and voice  
- The NEW backlink must appear exactly once in the content
- Use markdown link format: [${anchorText}](${backlinkUrl})
- **DO NOT remove or modify any existing links in the original content**
- Ensure the surrounding text makes the NEW link contextually appropriate`;

        // Add QC feedback if provided
        if (qcFeedback) {
            prompt += `

QUALITY CHECK FEEDBACK TO ADDRESS:
${qcFeedback}

Please address the above feedback while regenerating the content with the backlink integration.`;
        }

        prompt += `

Return the complete article with the NEW backlink naturally integrated. Do not add any explanations or comments outside the article content.`;

        return prompt;
    }

    /**
     * Generate a preview of the content (first 500 characters of body)
     * @param {string} content - The full article content
     * @returns {string} - Preview text
     */
    _generatePreviewContent(content) {
        try {
            // Remove frontmatter for preview
            const lines = content.split('\n');
            let bodyStart = 0;
            let inFrontmatter = false;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === '---') {
                    if (!inFrontmatter) {
                        inFrontmatter = true;
                    } else {
                        bodyStart = i + 1;
                        break;
                    }
                }
            }

            const bodyContent = lines.slice(bodyStart).join('\n').trim();
            
            // Return first 500 characters
            if (bodyContent.length <= 500) {
                return bodyContent;
            }
            
            return bodyContent.substring(0, 500) + '...';
        } catch (error) {
            // Fallback: return first 500 characters of entire content
            return content.length <= 500 ? content : content.substring(0, 500) + '...';
        }
    }

    /**
     * Apply quality check with regeneration using feedback
     * @param {string} originalContent - The original article content
     * @param {string} generatedContent - The initially generated content
     * @param {string} backlinkUrl - The backlink URL
     * @param {string} anchorText - The anchor text
     * @param {Object} options - { model?, provider?, maxQcRetries? }
     * @returns {Promise<string>} - The final quality-checked content
     */
    async applyQualityCheckWithRegeneration(originalContent, generatedContent, backlinkUrl, anchorText, options = {}) {
        const { runQC } = require('./articles/aiService');
        const model = options.model || 'gemini-2.5-flash';
        const provider = options.provider || 'gemini';
        const maxRetries = options.maxQcRetries || 3;
        
        let currentContent = generatedContent;
        let attempt = 1;

        while (attempt <= maxRetries) {
            console.log(`QC attempt ${attempt}/${maxRetries} for backlink integration`);

            try {
                // Run quality check
                const qcResult = await runQC(currentContent, {
                    backlinkUrl,
                    anchorText,
                    model,
                    provider,
                    noExternalBacklinks: false,
                    allowMultipleBacklinks: true // Allow multiple backlinks for customer integrations
                });

                console.log(`QC Result for attempt ${attempt}:`, qcResult);

                // Check if QC passed
                if (qcResult && qcResult.status === 'pass') {
                    console.log(`QC passed on attempt ${attempt}`);
                    return currentContent;
                }

                // If QC failed and we have feedback, regenerate
                if (qcResult && attempt < maxRetries) {
                    // Try different feedback fields that might be available
                    const feedback = qcResult.feedback || 
                                   qcResult.issues || 
                                   qcResult.suggestions || 
                                   (qcResult.errors && qcResult.errors.join('. ')) ||
                                   'Please improve the content quality and backlink integration.';
                    
                    console.log(`QC failed on attempt ${attempt}, regenerating with feedback:`, feedback);
                    
                    // Regenerate with QC feedback using original content as base
                    currentContent = await this.generateContentWithBacklink(
                        originalContent, 
                        backlinkUrl, 
                        anchorText, 
                        { 
                            ...options,
                            qcFeedback: feedback 
                        }
                    );
                    
                    attempt++;
                } else {
                    // No feedback or max retries reached
                    console.log(`QC failed on attempt ${attempt}, no actionable feedback available or max retries reached`);
                    console.log('Final QC Result:', JSON.stringify(qcResult, null, 2));
                    break;
                }
            } catch (error) {
                console.error(`QC error on attempt ${attempt}:`, error);
                if (attempt === maxRetries) {
                    // If last attempt failed, return the current content
                    console.log('Max QC retries reached, returning current content');
                    break;
                }
                attempt++;
            }
        }

        return currentContent;
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} - True if valid URL
     */
    _isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = BacklinkService;