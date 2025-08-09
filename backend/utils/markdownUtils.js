/**
 * Change the publication date in markdown frontmatter
 * @param {string} markdown - Markdown content
 * @param {Date} pubDate - Publication date (defaults to current date)
 * @returns {string} - Updated markdown content
 */
function changeArticlePubDate(markdown, pubDate = new Date()) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);
    if (!match) {
        return markdown;
    }
    const yamlContent = match[1];
    
    const lines = yamlContent.split('\n');
    const updatedLines = lines.map(line => {
        if (line.trim().startsWith('pubDate:')) {
            const newDate = pubDate.toISOString().split('T')[0];
            return `pubDate: ${newDate}`;
        }
        return line;
    });

    // If pubDate didn't exist, add it at the top
    const pubDateExists = lines.some(line => line.trim().startsWith('pubDate:'));
    if (!pubDateExists) {
        updatedLines.unshift(`pubDate: ${pubDate.toISOString().split('T')[0]}`);
    }

    const updatedYaml = updatedLines.join('\n');
    return markdown.replace(frontmatterRegex, `---\n${updatedYaml}\n---`);
}

/**
 * Extract title from markdown frontmatter
 * @param {string} markdown - Markdown content
 * @returns {string|null} - Extracted title or null
 */
function extractFrontmatterTitle(markdown) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);
    if (!match) return null;
  
    const yamlBlock = match[1];
  
    const titleMatch = yamlBlock.match(/^title:\s*(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : null;
}

function extractFrontmatter(markdown) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);
    if (!match) return null;
    return match[1];
}

/**
 * Extract article details from markdown frontmatter
 * @param {string} markdown - Markdown content with frontmatter
 * @returns {Object} - Extracted article details
 */
function extractArticleDetails(markdown) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);
    
    if (!match) {
        return {
            title: null,
            author: null,
            pubDate: null,
            description: null,
            tags: [],
            image: {
                url: null,
                alt: null
            }
        };
    }
    
    const yamlContent = match[1];
    const lines = yamlContent.split('\n');
    const details = {
        title: null,
        author: null,
        pubDate: null,
        description: null,
        tags: [],
        image: {
            url: null,
            alt: null
        }
    };
    
    let inImageBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('title:')) {
            const value = trimmedLine.substring(6).trim().replace(/^["']|["']$/g, '');
            details.title = value;
        } else if (trimmedLine.startsWith('author:')) {
            const value = trimmedLine.substring(7).trim().replace(/^["']|["']$/g, '');
            details.author = value;
        } else if (trimmedLine.startsWith('pubDate:')) {
            const value = trimmedLine.substring(8).trim().replace(/^["']|["']$/g, '');
            details.pubDate = value;
        } else if (trimmedLine.startsWith('description:')) {
            const value = trimmedLine.substring(12).trim().replace(/^["']|["']$/g, '');
            details.description = value;
        } else if (trimmedLine.startsWith('tags:')) {
            // Parse tags array
            const tagsMatch = trimmedLine.match(/tags:\s*\[(.*)\]/);
            if (tagsMatch) {
                const tagsStr = tagsMatch[1];
                details.tags = tagsStr.split(',').map(tag => 
                    tag.trim().replace(/^["']|["']$/g, '')
                ).filter(tag => tag.length > 0);
            }
        } else if (trimmedLine.startsWith('image:')) {
            inImageBlock = true;
            // Look for image properties in next lines
            let j = i + 1;
            while (j < lines.length && (lines[j].startsWith('  ') || lines[j].startsWith('\t'))) {
                const imageLine = lines[j].trim();
                if (imageLine.startsWith('alt:')) {
                    const altValue = imageLine.substring(4).trim().replace(/^["']|["']$/g, '');
                    details.image.alt = altValue;
                } else if (imageLine.startsWith('url:')) {
                    const urlValue = imageLine.substring(4).trim().replace(/^["']|["']$/g, '');
                    details.image.url = urlValue;
                }
                j++;
            }
            i = j - 1; // Skip the processed image lines
        }
    }
    
    return details;
}

/**
 * Fix and standardize frontmatter structure
 * @param {string} markdown - Markdown content with frontmatter
 * @returns {string} - Updated markdown content with corrected frontmatter
 */
function fixFrontmatterStructure(markdown) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = markdown.match(frontmatterRegex);
    
    if (!match) {
        return markdown;
    }
    
    const yamlContent = match[1];
    const lines = yamlContent.split('\n');
    const updatedLines = [];
    
    let hasImage = false;
    let imageDescription = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('pubDate:')) {
            // Remove quotes from pubDate
            const value = trimmedLine.substring(8).trim().replace(/^["']|["']$/g, '');
            updatedLines.push(`pubDate: ${new Date(value).toISOString().split('T')[0]}`);
        } else if (trimmedLine.startsWith('author:')) {
            // Remove quotes from author
            const value = trimmedLine.substring(7).trim().replace(/^["']|["']$/g, '');
            updatedLines.push(`author: ${value}`);
        } else if (trimmedLine.startsWith('title:')) {
            // Remove quotes and colons from title
            const value = trimmedLine.substring(6).trim().replace(/^["']|["']$/g, '').replace(/:/g, '');
            updatedLines.push(`title: ${value}`);
        } else if (trimmedLine.startsWith('description:')) {
            // Keep description but ensure it has quotes
            const value = trimmedLine.substring(12).trim();
            const cleanValue = value.replace(/^["']|["']$/g, '');
            updatedLines.push(`description: "${cleanValue}"`);
        } else if (trimmedLine.startsWith('image:')) {
            hasImage = true;
            updatedLines.push('image:');
            
            // Look for image properties in next lines
            let j = i + 1;
            while (j < lines.length && (lines[j].startsWith('  ') || lines[j].startsWith('\t'))) {
                const imageLine = lines[j].trim();
                if (imageLine.startsWith('description:')) {
                    // Remove image.description entirely - skip this line
                    j++;
                } else if (imageLine.startsWith('alt:')) {
                    // Ensure alt has quotes
                    const altValue = imageLine.substring(4).trim().replace(/^["']|["']$/g, '');
                    updatedLines.push(`  alt: "${altValue}"`);
                    j++;
                } else if (imageLine.startsWith('url:')) {
                    // Keep original url or use default
                    const urlValue = imageLine.substring(4).trim().replace(/^["']|["']$/g, '');
                    updatedLines.push(`  url: "${urlValue || 'https://picsum.photos/1280/720'}"`);
                    j++;
                } else {
                    // Skip any other image properties
                    j++;
                }
            }
            
            // Always add url if it wasn't found
            const hasUrl = updatedLines.some(line => line.trim().startsWith('url:'));
            if (!hasUrl) {
                updatedLines.push(`  url: "https://picsum.photos/1280/720"`);
            }
            
            i = j - 1; // Skip the processed image lines
        } else if (trimmedLine.startsWith('tags:')) {
            // Keep tags as is
            updatedLines.push(line);
        } else if (trimmedLine !== '') {
            // Keep other lines as is
            updatedLines.push(line);
        }
    }
    
    // If no image was found, add default image
    if (!hasImage) {
        updatedLines.push('image:');
        updatedLines.push('  url: "https://picsum.photos/1280/720"');
        updatedLines.push('  alt: "#"');
    }
    
    const updatedYaml = updatedLines.join('\n');
    const updatedMarkdown = markdown.replace(frontmatterRegex, `---\n${updatedYaml}\n---`);
    
    return updatedMarkdown;
}

module.exports = {
    changeArticlePubDate,
    extractFrontmatterTitle,
    extractFrontmatter,
    extractArticleDetails,
    fixFrontmatterStructure
}; 