const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Calls the Gemini API with the specified model and content.
 * @param {string} model - The Gemini model to use.
 * @param {string|object} content - The prompt or content to send.
 * @param {number} maxRetries - Maximum number of retry attempts for overloaded model
 * @returns {Promise<string>} - The generated text/content from Gemini.
 */
async function callGemini(content, modelName = 'gemini-2.5-flash', maxRetries = 3) {
    const model = genAI.getGenerativeModel({ model: modelName });
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(content);
            return result.response.text();
        } catch (error) {
            const errorMessage = error.message || error.toString();
            console.log(`Gemini API attempt ${attempt + 1}/${maxRetries + 1} failed:`, errorMessage);
            
            // Check if it's a retryable error (model overloaded, rate limit, or 5xx server errors)
            const isRetryableError = (
                errorMessage.includes('503 Service Unavailable') ||
                errorMessage.includes('The model is overloaded') ||
                errorMessage.includes('429 Too Many Requests') ||
                errorMessage.includes('500 Internal Server Error') ||
                errorMessage.includes('502 Bad Gateway') ||
                errorMessage.includes('504 Gateway Timeout')
            );
            
            // If this is the last attempt or not a retryable error, throw the error
            if (attempt === maxRetries || !isRetryableError) {
                console.error(`Gemini API failed after ${attempt + 1} attempts:`, errorMessage);
                throw new Error(errorMessage);
            }
            
            // Calculate exponential backoff delay (10s, 20s, 40s)
            const delay = Math.min(10000 * Math.pow(2, attempt), 60000); // Cap at 60 seconds
            console.log(`Retrying Gemini API in ${delay/1000} seconds... (attempt ${attempt + 1}/${maxRetries + 1})`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = { callGemini };
