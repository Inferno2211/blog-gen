const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload image by remote URL to Cloudinary (fetch).
 * Returns the secure_url.
 * @param {string} imageUrl
 * @returns {Promise<string>}
 */
async function uploadImageToCloudinary(imageUrl) {
  if (!imageUrl) throw new Error('Missing imageUrl');
  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: 'blog-images',
    overwrite: true,
    resource_type: 'image',
  });
  return result.secure_url || result.url;
}

module.exports = { uploadImageToCloudinary }; 