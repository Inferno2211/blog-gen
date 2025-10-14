const domainService = require('../../../services/domain/domainCrud');
const staticGen = require('../../../services/domain/staticGen');
const path = require('path');
const { buildDomain: buildDomainService, downloadDomain: downloadDomainService, getDomainStatus: getDomainStatusService } = require('../../../services/domain/domainBuildService');

// ===== DOMAIN CRUD OPERATIONS =====

// POST /api/v1/domain
// Supports single and bulk add, assigns tags, and can create template folder
async function createDomain(req, res) {
    try {
        const { name, slug, url, tags, template, domains } = req.body;
        // Bulk add
        if (Array.isArray(domains)) {
            const results = await domainService.bulkCreateDomains(domains, tags);
            // Handle template creation for successful domains
            for (const result of results) {
                if (result.success && template) {
                    try {
                        await staticGen.createDomainFolder(result.domain, template);
                    } catch (templateErr) {
                        // Log but don't fail the whole operation
                        console.warn(`Failed to create template for domain ${result.domain}:`, templateErr.message);
                    }
                }
            }
            return res.json({ results });
        }
        // Single add
        if (!name || !slug) {
            return res.status(400).json({
                error: 'Missing required fields: name and slug are required',
                details: { name: !!name, slug: !!slug }
            });
        }
        const domainData = {
            name,
            slug,
            url: url || '',
            tags: Array.isArray(tags) ? tags.join(',') : tags || '',
        };
        const created = await domainService.createDomain(domainData);
        // if (template) {
        //     await staticGen.createDomainFolder(slug, template);
        // }
        return res.json({ success: true, id: created.id, slug });
    } catch (err) {
        let errorMessage = 'Failed to create domain';
        let statusCode = 500;

        if (err.code === 'P2002') {
            errorMessage = `Domain with slug '${req.body.slug}' already exists`;
            statusCode = 409; // Conflict
        } else if (err.message.includes('Invalid')) {
            errorMessage = `Invalid domain data: ${err.message}`;
            statusCode = 400;
        } else if (err.message.includes('required')) {
            errorMessage = `Missing required fields: ${err.message}`;
            statusCode = 400;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Database operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/v1/domain/:id
async function getDomain(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                error: 'Domain ID is required',
                details: 'Please provide a valid domain ID in the URL'
            });
        }

        const result = await domainService.getDomain(id);
        if (!result) {
            return res.status(404).json({
                error: 'Domain not found',
                details: `No domain found with ID: ${id}`,
                suggestion: 'Please check the domain ID or create a new domain'
            });
        }
        res.json(result);
    } catch (err) {
        let errorMessage = 'Failed to retrieve domain';
        let statusCode = 500;

        if (err.message.includes('Invalid')) {
            errorMessage = `Invalid domain ID format: ${err.message}`;
            statusCode = 400;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Database query timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/v1/domain
// Returns all domains with associated articles, article count, and total count
async function getAllDomains(req, res) {
    try {
        const domains = await domainService.getAllDomainsWithArticles();
        const total = domains?.length || 0;
        if (domains) {
            const result = domains.map(d => ({
                id: d.id,
                name: d.name,
                slug: d.slug,
                url: d.url,
                tags: d.tags,
                created_at: d.created_at,
                articles: d.articles,
                articleCount: d.articles?.length || 0
            }));
            res.json({ total, domains: result });
        }
        else {
            res.json({ total, domains: [] });
        }
    } catch (err) {
        let errorMessage = 'Failed to retrieve domains';
        let statusCode = 500;

        if (err.message.includes('timeout')) {
            errorMessage = 'Database query timed out. Please try again.';
            statusCode = 408;
        } else if (err.message.includes('connection')) {
            errorMessage = 'Database connection failed. Please check your connection.';
            statusCode = 503;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// PUT /api/v1/domain/:id
async function updateDomain(req, res) {
    try {
        const { id } = req.params;
        const data = req.body;

        if (!id) {
            return res.status(400).json({
                error: 'Domain ID is required',
                details: 'Please provide a valid domain ID in the URL'
            });
        }

        if (!data || Object.keys(data).length === 0) {
            return res.status(400).json({
                error: 'Update data is required',
                details: 'Please provide at least one field to update'
            });
        }

        const result = await domainService.updateDomain(id, data);
        if (!result) {
            return res.status(404).json({
                error: 'Domain not found',
                details: `No domain found with ID: ${id}`,
                suggestion: 'Please check the domain ID or create a new domain'
            });
        }
        res.json(result);
    } catch (err) {
        let errorMessage = 'Failed to update domain';
        let statusCode = 500;

        if (err.code === 'P2002') {
            errorMessage = 'Domain with this slug already exists';
            statusCode = 409;
        } else if (err.message.includes('Invalid')) {
            errorMessage = `Invalid update data: ${err.message}`;
            statusCode = 400;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Database operation timed out. Please try again.';
            statusCode = 408;
        } else if (err.message.includes('not found')) {
            errorMessage = `Domain not found: ${err.message}`;
            statusCode = 404;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// DELETE /api/v1/domain/:id
async function deleteDomain(req, res) {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                error: 'Domain ID is required',
                details: 'Please provide a valid domain ID in the URL'
            });
        }

        const result = await domainService.deleteDomain(id);
        if (!result) {
            return res.status(404).json({
                error: 'Domain not found',
                details: `No domain found with ID: ${id}`,
                suggestion: 'Please check the domain ID'
            });
        }
        res.json({
            success: true,
            message: 'Domain deleted successfully',
            deletedDomain: result
        });
    } catch (err) {
        let errorMessage = 'Failed to delete domain';
        let statusCode = 500;

        if (err.message.includes('foreign key')) {
            errorMessage = 'Cannot delete domain: It has associated articles. Please remove articles first.';
            statusCode = 409;
        } else if (err.message.includes('not found')) {
            errorMessage = `Domain not found: ${err.message}`;
            statusCode = 404;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Database operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// ===== DOMAIN TEMPLATE/LAYOUT OPERATIONS =====

// GET /api/v1/domain/getAvailableTemplates
async function getAvailableTemplates(req, res) {
    try {
        const templates = await staticGen.getAvailableTemplates();
        res.json({
            success: true,
            templates,
            count: templates.length
        });
    } catch (err) {
        let errorMessage = 'Failed to retrieve available templates';
        let statusCode = 500;

        if (err.message.includes('ENOENT')) {
            errorMessage = 'Templates directory not found. Please check the templates configuration.';
            statusCode = 404;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied accessing templates directory.';
            statusCode = 403;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'File system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// POST /api/v1/domain/createDomainFolder
async function createDomainFolder(req, res) {
    try {
        const { domainName, overwrite = false } = req.body;

        if (!domainName) {
            return res.status(400).json({
                error: 'Domain name is required',
                details: 'Please provide a valid domain name'
            });
        }

        if (typeof domainName !== 'string' || domainName.trim().length === 0) {
            return res.status(400).json({
                error: 'Invalid domain name',
                details: 'Domain name must be a non-empty string'
            });
        }

        // Validate overwrite parameter
        if (typeof overwrite !== 'boolean') {
            return res.status(400).json({
                error: 'Invalid overwrite parameter',
                details: 'overwrite must be a boolean value'
            });
        }

        const domainPath = await staticGen.createDomainFolder(domainName, { overwrite });

        const message = overwrite
            ? `Domain '${domainName}' recreated successfully!`
            : `Domain '${domainName}' created successfully!`;

        res.json({
            success: true,
            domainName,
            domainPath,
            overwrite,
            message
        });
    } catch (err) {
        let errorMessage = 'Failed to create domain folder';
        let statusCode = 500;

        if (err.message.includes('already exists')) {
            errorMessage = `Domain folder '${req.body.domainName}' already exists`;
            statusCode = 409;
        } else if (err.message.includes('Template not found')) {
            errorMessage = 'Template directory not found. Please check the template configuration.';
            statusCode = 404;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied creating domain folder.';
            statusCode = 403;
        } else if (err.message.includes('disk space') || err.message.includes('ENOSPC')) {
            errorMessage = 'Insufficient disk space to create domain folder.';
            statusCode = 507;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'File system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// PUT /api/v1/domain/switchDomainTemplate
async function switchDomainTemplate(req, res) {
    try {
        const { domainName, newLayoutName } = req.body;

        if (!domainName || !newLayoutName) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'Both domainName and newLayoutName are required',
                provided: { domainName: !!domainName, newLayoutName: !!newLayoutName }
            });
        }

        const configPath = await staticGen.switchDomainTemplate(domainName, newLayoutName);

        res.json({
            success: true,
            domainName,
            newLayoutName,
            configPath,
            message: `Domain '${domainName}' switched to '${newLayoutName}' layout!`
        });
    } catch (err) {
        let errorMessage = 'Failed to switch domain template';
        let statusCode = 500;

        if (err.message.includes('not found')) {
            errorMessage = `Domain '${req.body.domainName}' not found`;
            statusCode = 404;
        } else if (err.message.includes('layout not found')) {
            errorMessage = `Layout '${req.body.newLayoutName}' not found in available templates`;
            statusCode = 404;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied updating domain configuration.';
            statusCode = 403;
        } else if (err.message.includes('ENOENT')) {
            errorMessage = 'Domain configuration file not found.';
            statusCode = 404;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'File system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/v1/domain/getDomainLayout/:domainName
async function getDomainLayout(req, res) {
    try {
        const { domainName } = req.params;

        if (!domainName) {
            return res.status(400).json({
                error: 'Domain name is required',
                details: 'Please provide a valid domain name in the URL'
            });
        }

        const layout = await staticGen.getDomainLayout(domainName);

        res.json({
            success: true,
            domainName,
            layout
        });
    } catch (err) {
        let errorMessage = 'Failed to get domain layout';
        let statusCode = 500;

        if (err.message.includes('not found')) {
            errorMessage = `Domain '${req.params.domainName}' not found`;
            statusCode = 404;
        } else if (err.message.includes('ENOENT')) {
            errorMessage = 'Domain configuration file not found.';
            statusCode = 404;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied reading domain configuration.';
            statusCode = 403;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'File system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/v1/domain/listDomains
async function listDomains(req, res) {
    try {
        const domains = await staticGen.listDomains();

        res.json({
            success: true,
            domains,
            count: domains.length
        });
    } catch (err) {
        let errorMessage = 'Failed to list domains';
        let statusCode = 500;

        if (err.message.includes('ENOENT')) {
            errorMessage = 'Domains directory not found. Please check the domains configuration.';
            statusCode = 404;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied accessing domains directory.';
            statusCode = 403;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'File system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// GET /api/v1/domain/getDomainInfo/:domainName
async function getDomainInfo(req, res) {
    try {
        const { domainName } = req.params;

        if (!domainName) {
            return res.status(400).json({
                error: 'Domain name is required',
                details: 'Please provide a valid domain name in the URL'
            });
        }

        const info = await staticGen.getDomainInfo(domainName);

        res.json({
            success: true,
            domainInfo: info
        });
    } catch (err) {
        let errorMessage = 'Failed to get domain info';
        let statusCode = 500;

        if (err.message.includes('not found')) {
            errorMessage = `Domain '${req.params.domainName}' not found`;
            statusCode = 404;
        } else if (err.message.includes('ENOENT')) {
            errorMessage = 'Domain configuration file not found.';
            statusCode = 404;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied reading domain information.';
            statusCode = 403;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'File system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// ===== BLOG OPERATIONS =====

// POST /api/v1/domain/addBlogToDomain
// DEPRECATED: Use addArticleToDomain instead for proper article formatting
async function addBlogToDomain(req, res) {
    return res.status(400).json({
        error: 'This endpoint is deprecated',
        details: 'Please use addArticleToDomain instead for proper article formatting with frontmatter',
        suggestion: 'Use POST /api/v1/domain/addArticleToDomain with articleId and domainName'
    });
}

// POST /api/v1/domain/addArticleToDomain
async function addArticleToDomain(req, res) {
    try {
        const { articleId, domainName } = req.body;

        if (!articleId || !domainName) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'Both articleId and domainName are required',
                provided: { articleId: !!articleId, domainName: !!domainName }
            });
        }

        const result = await staticGen.addArticleToDomain(articleId, domainName);

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err) {
        let errorMessage = 'Failed to add article to domain';
        let statusCode = 500;

        if (err.message.includes('article not found')) {
            errorMessage = `Article with ID '${req.body.articleId}' not found`;
            statusCode = 404;
        } else if (err.message.includes('domain not found')) {
            errorMessage = `Domain '${req.body.domainName}' not found`;
            statusCode = 404;
        } else if (err.message.includes('no selected version')) {
            errorMessage = `Article '${req.body.articleId}' has no selected version`;
            statusCode = 400;
        } else if (err.message.includes('already exists')) {
            errorMessage = `Blog post for article '${req.body.articleId}' already exists in domain '${req.body.domainName}'`;
            statusCode = 409;
        } else if (err.message.includes('permission')) {
            errorMessage = 'Permission denied writing article file.';
            statusCode = 403;
        } else if (err.message.includes('disk space')) {
            errorMessage = 'Insufficient disk space to create article file.';
            statusCode = 507;
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Database or file system operation timed out. Please try again.';
            statusCode = 408;
        } else {
            errorMessage = err.message;
        }

        res.status(statusCode).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
}

// ===== UTILITY OPERATIONS =====

// POST /api/v1/domain/buildDomain/:domainName
async function buildDomain(req, res) {
    try {
        const { domainName } = req.params;
        const { stdout } = await buildDomainService(domainName);
        res.json({ success: true, message: 'Site built successfully', stdout });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message, stderr: error.stderr });
    }
}

// GET /api/v1/domain/getBuildInstructions/:domainName
// async function getBuildInstructions(req, res) {
//     try {
//         const { domainName } = req.params;
//         const domainsBase = path.resolve(__dirname, '../../../../astro-builds/domains');
//         const domainPath = path.join(domainsBase, domainName);
//         const fs = require('fs-extra');

//         if (!await fs.pathExists(domainPath)) {
//             return res.status(404).json({
//                 error: 'Domain not found',
//                 details: `Domain '${domainName}' does not exist`,
//                 suggestion: 'Please create the domain first using createDomainFolder'
//             });
//         }

//         const instructions = {
//             domainName,
//             domainPath,
//             steps: [
//                 {
//                     step: 1,
//                     command: 'cd ' + domainPath,
//                     description: 'Navigate to the domain directory'
//                 },
//                 {
//                     step: 2,
//                     command: 'npm cache clean --force',
//                     description: 'Clear npm cache to avoid permission issues'
//                 },
//                 {
//                     step: 3,
//                     command: 'rmdir /s /q node_modules',
//                     description: 'Remove existing node_modules (Windows)'
//                 },
//                 {
//                     step: 4,
//                     command: 'npm install --force',
//                     description: 'Install dependencies with force flag'
//                 },
//                 {
//                     step: 5,
//                     command: 'npm run build',
//                     description: 'Build the project'
//                 }
//             ],
//             alternativeSteps: [
//                 {
//                     step: 'Alternative 1',
//                     command: 'npm install --no-optional',
//                     description: 'Install without optional dependencies'
//                 },
//                 {
//                     step: 'Alternative 2',
//                     command: 'npm install --legacy-peer-deps',
//                     description: 'Install with legacy peer dependency resolution'
//                 }
//             ],
//             troubleshooting: [
//                 'If you get permission errors, run PowerShell as Administrator',
//                 'If esbuild fails, try: npm install --force',
//                 'If network issues occur, check your internet connection',
//                 'If timeout occurs, increase the timeout in the API call'
//             ]
//         };

//         res.json({
//             success: true,
//             instructions
//         });
//     } catch (err) {
//         res.status(500).json({
//             error: 'Failed to get build instructions',
//             details: err.message,
//             timestamp: new Date().toISOString()
//         });
//     }
// }

// GET /api/v1/domain/downloadDomain/:domainName
async function downloadDomain(req, res) {
    try {
        const { domainName } = req.params;
        await downloadDomainService(domainName, res);
        // service handles streaming + headers
    } catch (error) {
        if (!res.headersSent) {
            res.status(error.status || 500).json({ success: false, message: error.message });
        }
    }
}

// GET /api/v1/domain/getDomainStatus/:domainName
async function getDomainStatus(req, res) {
    try {
        const { domainName } = req.params;
        const result = await getDomainStatusService(domainName);
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

// ===== PUBLIC ENDPOINTS =====

// GET /api/v1/domain/browse
// Browse domains for article requests (public endpoint)
async function browseDomains(req, res) {
    try {
        const domains = await domainService.getAllDomains();
        
        // Filter out sensitive information and only return domains that are ready for articles
        const publicDomains = domains.map(domain => ({
            id: domain.id,
            name: domain.name,
            slug: domain.slug,
            tags: domain.tags,
            // You could add more public fields here if needed
        }));

        res.json({
            success: true,
            domains: publicDomains,
            total: publicDomains.length
        });
    } catch (err) {
        console.error('Failed to browse domains:', err);
        res.status(500).json({ 
            success: false,
            error: 'Failed to load domains' 
        });
    }
}

module.exports = {
    // Public Operations
    browseDomains,

    // CRUD Operations
    createDomain,
    getDomain,
    getAllDomains,
    updateDomain,
    deleteDomain,

    // Template/Layout Operations
    getAvailableTemplates,
    createDomainFolder,
    switchDomainTemplate,
    getDomainLayout,
    listDomains,
    getDomainInfo,

    // Blog Operations
    addBlogToDomain,
    addArticleToDomain,

    // Utility Operations
    buildDomain,
    downloadDomain,
    // getBuildInstructions,
    getDomainStatus
}; 