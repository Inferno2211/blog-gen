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

  // Try to warm up the URL with retries
  let retries = 3;
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to generate image (attempt ${i + 1}/${retries}): ${prompt.slice(0, 50)}...`);
      const response = await axios.get(pollinationsUrl, { 
        responseType: 'arraybuffer', 
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.status === 200 && response.data.length > 1000) {
        console.log(`✅ Image generated successfully (${response.data.length} bytes)`);
        break;
      }
    } catch (error) {
      lastError = error;
      console.log(`❌ Attempt ${i + 1} failed:`, error.message);
      
      // Wait before retrying (exponential backoff)
      if (i < retries - 1) {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If all retries failed, log but continue (Cloudinary might still be able to fetch it)
  if (lastError) {
    console.log(`⚠️  Image generation had issues, but continuing: ${lastError.message}`);
  }

  return {
    url: pollinationsUrl,
    filename: `${Date.now()}_${safePrompt.slice(0, 40)}.png`,
  };
}

module.exports = { processImage }; 