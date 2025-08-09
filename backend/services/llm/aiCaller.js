const { callGemini } = require('./gemini');
const { callVllm } = require('./vllm');

/**
 * Sanitize AI response by removing backticks and JSON formatting
 * @param {string} response - Raw AI response
 * @returns {string} - Cleaned response
 */
function sanitizeResponse(response) {
    if (!response || typeof response !== 'string') {
        return response;
    }
    
    let cleaned = response.trim();

    // Prefer strictly delimited content when available
    const startTagRegex = /[<>]{3}START[<>]{3}/i;
    const endTagRegex = /[<>]{3}END[<>]{3}/i;
    const startMatch = cleaned.match(startTagRegex);
    const endMatch = cleaned.match(endTagRegex);
    if (startMatch && endMatch) {
        const startIndex = cleaned.indexOf(startMatch[0]) + startMatch[0].length;
        const endIndex = cleaned.indexOf(endMatch[0]);
        if (startIndex >= 0 && endIndex > startIndex) {
            cleaned = cleaned.substring(startIndex, endIndex);
        }
    } else {
        // If markers are missing, try to start at YAML frontmatter
        const yamlIndex = cleaned.indexOf('\n---\n');
        if (yamlIndex !== -1) {
            cleaned = cleaned.substring(yamlIndex + 1); // keep from first '---' line
        }
    }
    
    // Remove markdown code blocks (```json, ```, etc.)
    cleaned = cleaned.replace(/```(?:json|js|javascript|markdown)?\s*\n?/gi, '');
    cleaned = cleaned.replace(/```\s*$/gi, '');
    
    // Remove leading/trailing backticks
    cleaned = cleaned.replace(/^`+/, '').replace(/`+$/, '');
    
    // Remove any remaining backticks at the start/end of lines
    cleaned = cleaned.replace(/^\s*`/gm, '').replace(/`\s*$/gm, '');
    
    return cleaned.trim();
}

/**
 * Central AI call dispatcher.
 * @param {string|object} content - The prompt or content to send.
 * @param {Object} options - { provider: 'gemini'|'vllm', modelName: string }
 * @returns {Promise<string>} - The generated text/content from the selected AI.
 */
async function callAI(content, { provider = 'gemini', modelName } = {}) {
    let response;
    switch (provider) {
        case 'gemini':
            response = await callGemini(content, modelName);
            break;
        case 'vllm':
            response = await callVllm(content, modelName);
            break;
        default:
            throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    return sanitizeResponse(response);
}

module.exports = { callAI }; 