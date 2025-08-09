const slugify = require('slugify');
const fs = require('fs');
const path = require('path');

/**
 * Generate a unique slug-based filename for Astro posts
 * @param {string} topic - The blog topic
 * @param {string} niche - The niche/category
 * @param {string} postsDir - Directory to check for existing files
 * @returns {string} - Unique filename with .md extension
 */
function generateUniqueSlug(topic, niche, postsDir) {
    // Create base slug from niche and topic
    const baseSlug = slugify(`${niche} ${topic}`, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g
    });
    
    // Ensure slug is not too long
    let finalSlug = baseSlug;
    if (finalSlug.length > 60) {
        finalSlug = finalSlug.substring(0, 60);
    }
    
    // Remove trailing hyphens
    finalSlug = finalSlug.replace(/-+$/, '');
    
    // Generate unique filename
    let filename = finalSlug + '.md';
    let counter = 1;
    
    while (fs.existsSync(path.join(postsDir, filename))) {
        filename = `${finalSlug}-${counter}.md`;
        counter++;
    }
    
    return filename;
}

module.exports = { generateUniqueSlug }; 