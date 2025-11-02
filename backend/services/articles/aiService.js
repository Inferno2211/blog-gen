const { callAI } = require('../llm/aiCaller');
const { blogPrompt, guidePrompt } = require('../../data/prompts/article');
const { qualityPrompt } = require('../../data/prompts/quality');
const { Prisma } = require('@prisma/client');

/**
 * Generate article markdown using AI (Gemini/vLLM) and the blog prompt.
 * @param {Object} params - { niche, keyword, topic, n, targetURL, anchorText, model, provider, maxRetries, feedback, userPrompt, noExternalBacklinks, internalLinkCandidates }
 * @returns {Promise<string>} - Generated markdown content
 */
async function generateMarkdown({ niche, keyword, topic, n, targetURL, anchorText, model = 'gemini-2.5-flash', provider = 'gemini', maxRetries = 3, feedback = '', userPrompt, noExternalBacklinks = false, internalLinkCandidates = [] }) {
    let attempt = 0;
    let lastError;
    let basePrompt;
    let prompt;
    const today = new Date().toISOString().slice(0, 10);

    // Build base prompt
    if (!userPrompt) {
        basePrompt = blogPrompt
            .replace('{ Topic }', topic || '')
            .replace('{ Niche }', niche || '')
            .replace('{ Keyword }', keyword || '')
            .replace('{ Backlink Target URL }', noExternalBacklinks ? '' : (targetURL || ''))
            .replace('{ Anchor Text }', noExternalBacklinks ? '' : (anchorText || ''))
            .replace('{ n }', n || 3);
        prompt = guidePrompt.replace("{Today's Date (YYYY-MM-DD)}", today).replace('{ Title }', topic || '').replace('{ n }', n || 3);
    } else {
        basePrompt = userPrompt;
        // Provide a minimal structure guide to ensure Astro-compatible output
        prompt = guidePrompt.replace("{Today's Date (YYYY-MM-DD)}", today).replace('{ n }', n || 3);
    }

    // Constraints and directives
    const constraints = [];
    if (noExternalBacklinks) {
        constraints.push('Do NOT include any external/offsite backlinks or promotional links. Do not include any backlink section.');
    } else {
        // Only include backlink if provided
        if (targetURL && anchorText) {
            constraints.push(`Include exactly one backlink with anchor text "${anchorText}" to "${targetURL}" in a natural place.`);
        }
    }

    if (Array.isArray(internalLinkCandidates) && internalLinkCandidates.length > 0) {
        // Provide candidates and instruct to pick exactly one
        const candidatesJson = JSON.stringify(internalLinkCandidates.slice(0, 20));
        constraints.push('Internal linking: From the provided list of internal posts, randomly pick exactly one that is relevant and add exactly one markdown link to it in a natural location. Do NOT fabricate URLs. Use the provided slug/URL as-is.');
        prompt += `\n\n# Internal Link Candidates\n${candidatesJson}\n`;
    }

    if (constraints.length > 0) {
        prompt = `Keep in mind:\n- ${constraints.join('\n- ')}\n` + prompt;
    }

    prompt = basePrompt + '\n\n' + prompt;

    if (feedback) {
        prompt += `\n\n# QC Feedback to Address:\n${feedback}`;
    }

    // console.log('Prompt: ', prompt);

    while (attempt < maxRetries) {
        try {
            return await callAI(prompt, { provider, modelName: model, maxRetries: 3 });
        } catch (err) {
            lastError = err;
            attempt++;
        }
    }
    throw lastError;
}

/**
 * Run quality check on article markdown using AI and the QC prompt.
 * @param {string} articleText - The markdown content to check
 * @param {Object} params - { backlinkUrl, anchorText, model, provider, maxRetries, noExternalBacklinks, expectedInternalSlugs }
 * @returns {Promise<Object>} - QC result as JSON
 */
async function runQC(articleText, { backlinkUrl, anchorText, model = 'gemini-2.5-flash', provider = 'gemini', maxRetries = 3, noExternalBacklinks = false, expectedInternalSlugs = [], allowMultipleBacklinks = false } = {}) {
    let attempt = 0;
    let lastError;

    let prompt = qualityPrompt
        .replace('{ARTICLE_TEXT}', articleText)
        .replace('{BACKLINK_URL}', backlinkUrl || '')
        .replace('{BACKLINK_ANCHOR_TEXT}', anchorText || '');

    // Adjust guidance when external backlinks are disallowed
    if (noExternalBacklinks) {
        prompt += `\n\nAdditional Instructions:\n- For this article, external/offsite backlinks are NOT allowed.\n- Ignore the requirement to include a backlink.\n- If any external link appears, list it as an issue and set flags.missing_backlink = false and fail the article.\n`;
    }

    // Adjust guidance when multiple backlinks are allowed (customer backlink integration)
    if (allowMultipleBacklinks) {
        prompt += `\n\nMultiple Backlinks Allowed:\n- This article is being updated with a CUSTOMER backlink integration.\n- The article may contain MULTIPLE external backlinks (original + new customer backlink).\n- **DO NOT flag or fail the article for having multiple external backlinks**.\n- Only verify that the SPECIFIC backlink with URL "${backlinkUrl}" and anchor text "${anchorText}" is present.\n- Existing backlinks should remain unchanged and are acceptable.\n- Focus on content quality, naturalness, and proper integration of the new backlink.\n`;
    }

    if (Array.isArray(expectedInternalSlugs) && expectedInternalSlugs.length > 0) {
        const slugs = expectedInternalSlugs.slice(0, 20);
        prompt += `\n\nInternal Linking Expectation:\n- Prefer (but do not strictly require) exactly one internal link to one of these slugs if relevant: ${JSON.stringify(slugs)}\n`;
    }
    else {
        prompt += `\n\nInternal Linking Expectation:\n- Do not include any internal links.`;
    }

    while (attempt < maxRetries) {
        try {
            const result = await callAI(prompt, { provider, modelName: model, maxRetries: 3 });
            return JSON.parse(result);
        } catch (err) {
            // console.error('JSON Parse Error:', err.message);
            lastError = err;
            attempt++;
        }
    }
    throw lastError;
}

/**
 * Infer article details from either a user prompt (intention) or article markdown text.
 * @param {Object} input - { userPrompt?: string, articleText?: string, model?, provider? }
 * @returns {Promise<{anchorText?: string, backlinkUrl?: string, niche?: string, keyword?: string, topic?: string}>}
 */
async function inferArticleDetails({ userPrompt, articleText, model = 'gemini-2.5-flash', provider = 'gemini' } = {}) {
    if (!userPrompt && !articleText) {
        throw new Error('inferArticleDetails requires either userPrompt or articleText');
    }

    const source = userPrompt ? 'INTENT' : 'ARTICLE';
    const extractionPrompt = `You are a helpful assistant that infers article meta details from ${source === 'INTENT' ? 'a user intent/prompt' : 'the markdown article text'}.
        Return ONLY a JSON object (no backticks) with keys: anchorText, backlinkUrl, niche, keyword, topic. If a value is unknown or not applicable, set it to an empty string.
        PLEASE DO NOT ASSUME ANY INFORMATION FROM THE INPUT.

        The topic should be the main topic of the article. It should be such that it can be used to generate a unique slug.
        {
            "anchorText": "string",
            "backlinkUrl": "string",
            "niche": "string",
            "keyword": "string",
            "topic": "string"
        }

        Input:
        ${userPrompt || articleText}`;

    const result = await callAI(extractionPrompt, { provider, modelName: model, maxRetries: 3 });
    try {
        return JSON.parse(result);
    } catch (e) {
        // Fallback minimal inference
        return { anchorText: '', backlinkUrl: '', niche: '', keyword: '', topic: '' };
    }
}

module.exports = {
    generateMarkdown,
    runQC,
    inferArticleDetails
};