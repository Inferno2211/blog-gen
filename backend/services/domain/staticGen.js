const fs = require('fs-extra');
const path = require('path');
const { addBlogToDomain: addBlogFromCore } = require('../articles/coreServices');

// Configurable base paths
const LAYOUTS_BASE = path.resolve(__dirname, '../../../astro-builds/templates/layouts');
const DOMAINS_BASE = path.resolve(__dirname, '../../../astro-builds/domains');
const TEMPLATE_BASE = path.resolve(__dirname, '../../../astro-builds/templates/template');

/**
 * Gets available templates (layouts) from the layouts directory
 * @param {object} [options] - Optional: { layoutsBase }
 * @returns {Promise<Array>} - Array of available template names
 */
async function getAvailableTemplates(options = {}) {
    const layoutsBase = options.layoutsBase || LAYOUTS_BASE;
    try {
        const items = await fs.readdir(layoutsBase);
        const templates = [];
        
        for (const item of items) {
            if (item.endsWith('.astro')) {
                templates.push(item.replace('.astro', ''));
            }
        }
        
        return templates;
    } catch (error) {
        console.error('Error reading layouts directory:', error);
        return [];
    }
}

/**
 * Creates a new domain by copying the template folder
 * @param {string} domainName - The folder name for the new domain
 * @param {object} [options] - Optional: { domainsBase, templateBase, overwrite }
 * @returns {Promise<string>} - The path to the created domain folder
 */
async function createDomainFolder(domainName, options = {}) {
    const domainsBase = options.domainsBase || DOMAINS_BASE;
    const templateBase = options.templateBase || TEMPLATE_BASE;
    const dest = path.join(domainsBase, domainName);
    
    // Validate template exists
    if (!await fs.pathExists(templateBase)) {
        throw new Error('Template not found');
    }
    
    await fs.ensureDir(domainsBase);
    
    // Check if domain already exists
    const domainExists = await fs.pathExists(dest);
    
    if (domainExists) {
        if (options.overwrite) {
            // Remove existing domain and recreate
            await fs.remove(dest);
            console.log(`🔄 Domain '${domainName}' already exists. Overwriting...`);
        } else {
            throw new Error(`Domain folder '${domainName}' already exists. Use overwrite: true option to replace it.`);
        }
    }
    
    try {
        // Copy the entire template to the new domain
        await fs.copy(templateBase, dest, { overwrite: false, errorOnExist: false });
        
        console.log(`Domain '${domainName}' created successfully!`);
        // console.log(`📁 Location: ${dest}`);
        // console.log(`📋 Next steps:`);
        // console.log(`   1. cd ${dest}`);
        // console.log(`   2. npm install`);
        // console.log(`   3. npm run dev`);
        
        return dest;
    } catch (error) {
        // Clean up partial copy if it exists
        if (await fs.pathExists(dest)) {
            try {
                await fs.remove(dest);
            } catch (cleanupError) {
                console.error('Failed to clean up partial domain folder:', cleanupError);
            }
        }
        
        // Re-throw with more context
        if (error.message.includes('already exists')) {
            throw new Error(`Domain folder '${domainName}' already exists. Use overwrite: true option to replace it.`);
        } else if (error.message.includes('permission')) {
            throw new Error('Permission denied creating domain folder. Please check file permissions.');
        } else if (error.message.includes('disk space') || error.message.includes('ENOSPC')) {
            throw new Error('Insufficient disk space to create domain folder.');
        } else {
            throw new Error(`Failed to create domain folder: ${error.message}`);
        }
    }
}

/**
 * Switches a domain to use a different template (layout)
 * @param {string} domainName - The domain folder name
 * @param {string} newLayoutName - The new layout to use
 * @param {object} [options] - Optional: { domainsBase }
 * @returns {Promise<string>} - The path to the updated config file
 */
async function switchDomainTemplate(domainName, newLayoutName, options = {}) {
    const domainsBase = options.domainsBase || DOMAINS_BASE;
    const domainPath = path.join(domainsBase, domainName);
    const configPath = path.join(domainPath, 'src', 'layout-config.json');
    
    // Validate domain exists
    if (!await fs.pathExists(domainPath)) {
        throw new Error(`Domain '${domainName}' not found`);
    }
    
    // Validate layout exists
    const layoutsBase = options.layoutsBase || LAYOUTS_BASE;
    const layoutPath = path.join(layoutsBase, `${newLayoutName}.astro`);
    if (!await fs.pathExists(layoutPath)) {
        throw new Error(`Layout '${newLayoutName}' not found`);
    }
    
    // Read current config
    let config = {};
    if (await fs.pathExists(configPath)) {
        config = await fs.readJson(configPath);
    }
    
    // Update the layout
    config.activeLayout = newLayoutName;
    config.lastModified = new Date().toISOString();
    
    // Write updated config
    await fs.writeJson(configPath, config, { spaces: 2 });
    
    console.log(`✅ Domain '${domainName}' switched to '${newLayoutName}' layout!`);
    console.log(`📁 Config updated: ${configPath}`);
    
    return configPath;
}

/**
 * Gets the current layout for a domain
 * @param {string} domainName - The domain folder name
 * @param {object} [options] - Optional: { domainsBase }
 * @returns {Promise<string>} - The current layout name
 */
async function getDomainLayout(domainName, options = {}) {
    const domainsBase = options.domainsBase || DOMAINS_BASE;
    const domainPath = path.join(domainsBase, domainName);
    const configPath = path.join(domainPath, 'src', 'layout-config.json');
    
    if (!await fs.pathExists(configPath)) {
        throw new Error(`Domain '${domainName}' not found or invalid`);
    }
    
    const config = await fs.readJson(configPath);
    return config.activeLayout || 'MicroblogLayout';
}

// /**
//  * Writes a blog post to the content/posts folder of a domain.
//  * @param {string} domainSlug - The folder name for the domain
//  * @param {string} fileName - The name of the blog file (e.g. my-post.md)
//  * @param {string} content - The markdown content to write
//  * @param {object} [options] - Optional: { domainsBase }
//  * @returns {Promise<string>} - The path to the written blog file
//  */
// async function addBlogToDomain(domainSlug, fileName, content, options = {}) {
//     const domainsBase = options.domainsBase || DOMAINS_BASE;
//     const destDir = path.join(domainsBase, domainSlug, 'src', 'content', 'posts');
//     await fs.ensureDir(destDir);
//     const dest = path.join(destDir, fileName);
//     await fs.writeFile(dest, content, 'utf8');
//     return dest;
// }

// /**
//  * Add a blog post from an article to a specified domain
//  * @param {string} articleId - The article's ID
//  * @param {string} domainName - The domain folder name
//  * @param {Object} options - Optional configuration
//  * @returns {Promise<{success: boolean, filePath: string, message: string}>}
//  */
// async function addArticleToDomain(articleId, domainName, options = {}) {
//     return await addBlogFromCore(articleId, domainName, options);
// }

/**
 * Gets domain information
 * @param {string} domainName - The domain folder name
 * @param {object} [options] - Optional: { domainsBase }
 * @returns {Promise<object>} - Domain configuration
 */
async function getDomainInfo(domainName, options = {}) {
    const domainsBase = options.domainsBase || DOMAINS_BASE;
    const domainPath = path.join(domainsBase, domainName);
    const configPath = path.join(domainPath, 'src', 'layout-config.json');
    
    if (!await fs.pathExists(configPath)) {
        throw new Error(`Domain '${domainName}' not found or invalid`);
    }
    
    const config = await fs.readJson(configPath);
    return {
        domainName: domainName,
        layout: config.activeLayout,
        lastModified: config.lastModified,
        configPath: configPath
    };
}

/**
 * Lists all domains
 * @param {object} [options] - Optional: { domainsBase }
 * @returns {Promise<Array>} - Array of domain information
 */
async function listDomains(options = {}) {
    const domainsBase = options.domainsBase || DOMAINS_BASE;
    
    if (!await fs.pathExists(domainsBase)) {
        return [];
    }
    
    const items = await fs.readdir(domainsBase);
    const domains = [];
    
    for (const item of items) {
        const domainPath = path.join(domainsBase, item);
        const stats = await fs.stat(domainPath);
        if (stats.isDirectory()) {
            try {
                const domainInfo = await getDomainInfo(item, options);
                domains.push(domainInfo);
            } catch (error) {
                console.warn(`Skipping invalid domain: ${item}`);
            }
        }
    }
    
    return domains;
}

module.exports = {
    createDomainFolder,
    switchDomainTemplate,
    getDomainLayout,
    // addBlogToDomain,
    // addArticleToDomain,
    getAvailableTemplates,
    getDomainInfo,
    listDomains,
    LAYOUTS_BASE,
    DOMAINS_BASE,
    TEMPLATE_BASE
};
