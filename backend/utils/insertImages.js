const { processImage } = require('../services/images/imageGenerator');
const { uploadImageToCloudinary } = require('../services/images/uploadImages');

/**
 * Parse YAML frontmatter from markdown
 * @param {string} markdown - Full markdown content
 * @returns {Object} - {frontmatter: object, content: string, originalYaml: string}
 */
function parseFrontmatter(markdown) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = markdown.match(frontmatterRegex);
    
    if (!match) {
        return { frontmatter: {}, content: markdown, originalYaml: '' };
    }
    
    const yamlContent = match[1];
    const markdownContent = match[2];
    const frontmatter = parseYamlSection(yamlContent);
    
    return { frontmatter, content: markdownContent, originalYaml: yamlContent };
}

/**
 * Simple YAML parser for frontmatter
 * @param {string} yamlString - YAML content
 * @returns {Object} - Parsed object
 */
function parseYamlSection(yamlString) {
    const result = {};
    const lines = yamlString.split('\n');
    let currentKey = null;
    let currentObject = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const indent = line.length - line.trimStart().length;
        
        if (indent === 0 && trimmed.includes(':')) {
            const [key, value] = trimmed.split(':').map(s => s.trim());
            if (value && !value.startsWith('[')) {
                // Simple key-value
                result[key] = value.replace(/^["']|["']$/g, '');
            } else if (value.startsWith('[') && value.endsWith(']')) {
                // Array value
                result[key] = JSON.parse(value);
            } else {
                // Object key
                currentKey = key;
                result[key] = {};
                currentObject = result[key];
            }
        } else if (currentObject && indent > 0 && trimmed.includes(':')) {
            const [key, value] = trimmed.split(':').map(s => s.trim());
            if (value) {
                currentObject[key] = value.replace(/^["']|["']$/g, '');
            }
        }
    }
    
    return result;
}

/**
 * Serialize object back to YAML
 * @param {Object} obj - Object to serialize  
 * @param {string} originalYaml - Original YAML for reference
 * @returns {string} - YAML string
 */
function serializeToYaml(obj, originalYaml = '') {
    let yaml = '';
    
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            yaml += `${key}:\n`;
            for (const [subKey, subValue] of Object.entries(value)) {
                yaml += `  ${subKey}: "${subValue}"\n`;
            }
        } else if (Array.isArray(value)) {
            yaml += `${key}: ${JSON.stringify(value)}\n`;
        } else {
            yaml += `${key}: ${value}\n`;
        }
    }
    
    return yaml;
}

/**
 * Find all inline image placeholders
 * @param {string} content - Markdown content
 * @returns {Array} - Array of image info objects
 */
function findInlineImages(content) {
    const regex = /!\[([^\]]*)\]\(<!--IMG_INLINE_DESC:\s*([^>]+)-->\)/g;
    const images = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
        images.push({
            fullMatch: match[0],
            altText: match[1].trim(),
            description: match[2].trim(),
            index: match.index
        });
    }
    
    return images;
}

/**
 * Process all images in parallel and upload to Cloudinary
 * @param {Array} imageInfos - Array of image info objects
 * @returns {Promise<Array>} - Array of processed image results
 */
async function processImagesInParallel(imageInfos) {
    console.log(`Processing ${imageInfos.length} images in parallel...`);
    
    const promises = imageInfos.map(async (imageInfo, index) => {
        try {
            console.log(`Processing image ${index + 1}: "${imageInfo.description}"`);
            const result = await processImage(imageInfo.description, imageInfo.altText);
            
            // Upload to Cloudinary
            console.log(`Uploading image ${index + 1} to Cloudinary...`);
            const cloudinaryUrl = await uploadImageToCloudinary(result.url);
            
            return { 
                ...imageInfo, 
                result: { ...result, url: cloudinaryUrl }, 
                success: true 
            };
        } catch (error) {
            console.error(`Failed to process image ${index + 1}:`, error.message);
            return { ...imageInfo, result: null, success: false };
        }
    });
    
    return await Promise.all(promises);
}

/**
 * Replace inline images in content
 * @param {string} content - Original markdown content
 * @param {Array} processedImages - Processed image results
 * @returns {string} - Updated content
 */
function replaceInlineImages(content, processedImages) {
    let updatedContent = content;
    
    // Sort by index in reverse order to maintain positions
    const sortedImages = processedImages.sort((a, b) => b.index - a.index);
    
    for (const imageInfo of sortedImages) {
        if (imageInfo.success && imageInfo.result) {
            const newImageMarkdown = `![${imageInfo.altText || imageInfo.description}](${imageInfo.result.url})`;
            updatedContent = updatedContent.substring(0, imageInfo.index) + 
                           newImageMarkdown + 
                           updatedContent.substring(imageInfo.index + imageInfo.fullMatch.length);
        }
    }
    
    return updatedContent;
}

/**
 * Main function to process images in markdown
 * @param {string} markdown - Original markdown content
 * @returns {Promise<string>} - Updated markdown with processed images
 */
async function insertImages(markdown) {
    try {
        console.log('Starting image processing...');
        
        // Parse frontmatter and content
        const { frontmatter, content, originalYaml } = parseFrontmatter(markdown);
        
        // Collect all images to process
        const imagesToProcess = [];
        
        // Add header image if it has description
        if (frontmatter.image?.description) {
            imagesToProcess.push({
                type: 'header',
                description: frontmatter.image.description,
                altText: frontmatter.image.alt || 'Header image'
            });
        }
        
        // Find inline images
        const inlineImages = findInlineImages(content);
        imagesToProcess.push(...inlineImages.map(img => ({ ...img, type: 'inline' })));
        
        if (imagesToProcess.length === 0) {
            console.log('No images found to process');
            return markdown;
        }
        
        // Process all images in parallel
        const processedImages = await processImagesInParallel(imagesToProcess);
        
        // Update header image in frontmatter
        let updatedFrontmatter = { ...frontmatter };
        const headerImage = processedImages.find(img => img.type === 'header');
        if (headerImage?.success && headerImage.result) {
            updatedFrontmatter.image = {
                url: headerImage.result.url,
                alt: headerImage.altText
            };
            console.log(`Header image updated: ${headerImage.result.filename}`);
        }
        
        // Replace inline images
        const inlineImageResults = processedImages.filter(img => img.type === 'inline');
        const updatedContent = replaceInlineImages(content, inlineImageResults);
        
        // Reconstruct markdown
        const finalYaml = serializeToYaml(updatedFrontmatter, originalYaml);
        const result = `---\n${finalYaml}---\n${updatedContent}`;
        
        console.log('Image processing completed successfully!');
        return result;
        
    } catch (error) {
        console.error('Error in image processing:', error);
        return markdown; // Return original on error
    }
}

module.exports = { insertImages };