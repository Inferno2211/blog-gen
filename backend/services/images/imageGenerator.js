const axios = require('axios');

/**
 * Generate an image using Pollinations based on description/alt text.
 * Returns a direct Pollinations image URL that can be ingested by Cloudinary.
 *
 * @param {string} description - Image description or prompt
 * @param {string} altText - Alt text; used to improve the prompt
 * @returns {Promise<{ url: string, filename: string }>} result
 */
async function processImage(description, altText) {
  const basePrompt = `${altText || ''} ${description || ''}`.trim();
  const prompt = basePrompt || 'high quality blog header image';

  // Build Pollinations URL (server will render an image for the prompt)
  const width = 1280;
  const height = 720;
  const safePrompt = encodeURIComponent(prompt);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=${width}&height=${height}&nologo=true`;

  // Optionally, you can warm up the URL to ensure it exists before Cloudinary fetch
  try {
    await axios.get(pollinationsUrl, { responseType: 'arraybuffer', timeout: 30000 });
  } catch (_) {
    // Ignore warm-up failures; Cloudinary fetch will attempt anyway
  }

  return {
    url: pollinationsUrl,
    filename: `${Date.now()}_${safePrompt.slice(0, 40)}.png`,
  };
}

module.exports = { processImage }; 