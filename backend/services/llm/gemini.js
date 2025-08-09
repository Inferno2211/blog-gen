const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Calls the Gemini API with the specified model and content.
 * @param {string} model - The Gemini model to use.
 * @param {string|object} content - The prompt or content to send.
 * @returns {Promise<string>} - The generated text/content from Gemini.
 */
async function callGemini(content, modelName = 'gemini-2.5-flash') {
    try {

        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(content);

        return result.response.text();
    } catch (error) {
        // console.log(error);
        throw new Error(error);
    }
}

module.exports = { callGemini };
