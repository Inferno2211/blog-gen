const prisma = require('../../db/prisma');
const { updateArticle, getArticle } = require('./dbCrud');
const { generateMarkdown, runQC, inferArticleDetails } = require('./aiService');
const { getUniqueArticleSlug, getUniqueArticleSlugExcludingId } = require('../../utils/article');
const fs = require('fs-extra');
const path = require('path');
const { extractFrontmatter, fixFrontmatterStructure, extractArticleDetails } = require('../../utils/markdownUtils');
const { insertImages } = require('../../utils/insertImages');

/**
 * Sanitize and slugify a string for use as a filename
 * @param {string} str - The string to slugify
 * @returns {string} - The sanitized slug
 */
function slugify(str) {
    if (!str) return 'untitled-article';

    return str
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
        .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Fetch internal link candidates for a domain to assist AI in adding one internal link.
 * @param {string} domainId
 * @param {string} [excludeArticleId]
 * @returns {Promise<Array<{title:string, slug:string, url:string}>>}
 */
async function getInternalLinkCandidates(domainId, excludeArticleId) {
    if (!domainId) return [];
    const candidates = await prisma.article.findMany({
        where: {
            domain_id: domainId,
            id: excludeArticleId ? { not: excludeArticleId } : undefined
        },
        select: { id: true, slug: true, topic: true }
    });
    return candidates
        .filter(a => a.slug)
        .map(a => ({
            title: a.topic || a.slug,
            slug: a.slug,
            url: `/posts/${a.slug}/`
        }));
}

/** Helper: count external links (http/https) */
function countExternalLinks(markdown) {
    const regex = /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/gi;
    let count = 0;
    while (regex.exec(markdown)) count++;
    return count;
}

/** Helper: check specific backlink exists (anchor + URL) */
function hasSpecificBacklink(markdown, targetUrl, anchorText) {
    if (!targetUrl || !anchorText) return false;
    const escapedUrl = targetUrl.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');
    const escapedAnchor = anchorText.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');
    try {
        const regex = new RegExp(`\\[([^\\]]*${escapedAnchor}[^\\]]*)\\]\\(${escapedUrl}\\)`, 'i');
        return regex.test(markdown);
    } catch (error) {
        console.warn('Invalid regex for backlink check:', { targetUrl, anchorText }, error.message);
        // Fallback to simple string search
        return markdown.includes(`[${anchorText}](${targetUrl})`) || markdown.includes(`](${targetUrl})`);
    }
}

/** Helper: count internal links to /posts/... */
function countInternalLinks(markdown) {
    const regex = /\[[^\]]+\]\((\/posts\/[\w-]+\/?)\)/gi;
    let count = 0;
    while (regex.exec(markdown)) count++;
    return count;
}

/** Helper: whether any internal link is to expected candidates */
function hasInternalLinkToCandidates(markdown, candidates = []) {
    if (!Array.isArray(candidates) || candidates.length === 0) return false;
    return candidates.some((c) => {
        const url = c?.url || '';
        if (!url) return false;
        // More robust escaping for URLs that might contain special regex characters
        const escapedUrl = url.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');
        try {
            const regex = new RegExp(`\\]\(${escapedUrl}\\)`, 'i');
            return regex.test(markdown);
        } catch (error) {
            console.warn('Invalid regex for URL:', url, error.message);
            // Fallback to simple string search
            return markdown.includes(`](${url})`);
        }
    });
}

/**
 * Perform QC loop for an article, auto-regenerating if needed, but only saving passed versions.
 * Pipeline:
 * 1) QC with Gemini using inferred details and flags
 * 2) Enforce backlink/internal-link presence based on flags
 * 3) Retry by regenerating content (generation model only) until pass or max retries
 * @param {string} articleId - The article's ID
 * @param {string} content - The initial article content
 * @param {number} maxRetries - Maximum QC attempts (default 3)
 * @param {Object} options - { provider, model, userPrompt?, noExternalBacklinks?, internalLinkCandidates? }
 * @returns {Promise<{versionId: string|null, versionNum: number|null, content: string, qcResult: object|null, inferred: object|null, status: string}>}
 */
async function performQC(articleId, content, maxRetries = 3, options = {}) {
    // Fetch article meta for prompt regeneration
    const article = await getArticle(articleId);
    if (!article) throw new Error('Article not found');

    const generationProvider = options.provider; // generation provider
    const generationModel = options.model; // generation model

    let attempt = 0;
    let lastQCResult = null;
    let lastContent = content;
    let status = 'failed';
    let versionNum = (article.versions?.length || 0) + 1;

    const meta = {
        niche: article.niche,
        keyword: article.keyword,
        topic: article.topic,
        n: 3,
        targetURL: options.noExternalBacklinks ? '' : article.backlink_target,
        anchorText: options.noExternalBacklinks ? '' : article.anchor,
        model: generationModel || 'gemini-2.5-flash', // ONLY used for generation retries
        provider: generationProvider || 'gemini',     // ONLY used for generation retries
        userPrompt: options.userPrompt || ''
    };

    const expectedInternalSlugs = Array.isArray(options.internalLinkCandidates)
        ? options.internalLinkCandidates.map(c => c.slug)
        : [];

    let finalVersionId = null;
    let finalVersionNum = null;
    let finalQCResult = null;
    let inferredFromContent = null;

    while (attempt < maxRetries) {
        // 1) QC with Gemini and infer content meta via Gemini
        const qcModel = 'gemini-2.5-flash';
        const qcProvider = 'gemini';

        // Infer details from current content for QC context
        inferredFromContent = await inferArticleDetails({ articleText: lastContent, model: qcModel, provider: qcProvider });

        // Prefer explicitly inferred details for backlink expectations
        const backlinkUrl = options.noExternalBacklinks ? '' : (inferredFromContent.backlinkUrl || meta.targetURL || '');
        const anchorText = options.noExternalBacklinks ? '' : (inferredFromContent.anchorText || meta.anchorText || '');

        lastQCResult = await runQC(lastContent, {
            backlinkUrl,
            anchorText,
            model: qcModel,
            provider: qcProvider,
            noExternalBacklinks: !!options.noExternalBacklinks,
            expectedInternalSlugs
        });

        // 2) Enforce backlink/internal-link rules based on flags
        let hardChecksPass = true;

        if (options.noExternalBacklinks) {
            // No external links allowed
            const externalCount = countExternalLinks(lastContent);
            if (externalCount > 0) hardChecksPass = false;
        } else {
            // Backlink required only if we have explicit target+anchor
            if (backlinkUrl && anchorText) {
                const present = hasSpecificBacklink(lastContent, backlinkUrl, anchorText);
                if (!present) hardChecksPass = false;
            }
        }

        const internalExpected = Array.isArray(options.internalLinkCandidates) && options.internalLinkCandidates.length > 0;
        if (internalExpected) {
            // Require exactly one internal link to candidates
            const internalCount = countInternalLinks(lastContent);
            const hasToCandidates = hasInternalLinkToCandidates(lastContent, options.internalLinkCandidates);
            if (!(internalCount === 1 && hasToCandidates)) hardChecksPass = false;
        } else {
            // When disabled, do not include any internal link
            const internalCount = countInternalLinks(lastContent);
            if (internalCount > 0) hardChecksPass = false;
        }

        console.log('Hard checks pass: ', hardChecksPass);
        console.log('Last QC result: ', lastQCResult);
        const qcPass = lastQCResult && (lastQCResult.status === 'pass');
        if (qcPass && hardChecksPass) {
            const fixedContent = fixFrontmatterStructure(lastContent);
            
            // Process images before saving to database
            console.log('Processing images in article content...');
            let contentWithImages;
            try {
                contentWithImages = await insertImages(fixedContent);
                console.log('Images processed successfully');
            } catch (imageError) {
                console.warn('Image processing failed, using original content:', imageError.message);
                contentWithImages = fixedContent;
            }
            
            const versionData = {
                article_id: articleId,
                version_num: versionNum,
                content_md: contentWithImages,
                qc_attempts: attempt + 1,
                last_qc_status: lastQCResult.status,
                last_qc_notes: lastQCResult,
                prompt: meta.userPrompt || ''
            };

            // Save immediately on pass
            const saved = await prisma.articleVersion.create({ data: versionData });
            finalVersionId = saved.id;
            finalVersionNum = versionNum;
            finalQCResult = lastQCResult;
            status = 'passed';
            lastContent = contentWithImages;
            break;
        }

        // 3) Retry generation if not last attempt
        if (attempt < maxRetries - 1) {
            console.log('\n\nQC failed, retrying generation');
            const newContent = await generateMarkdown({
                ...meta,
                feedback: '',
                noExternalBacklinks: !!options.noExternalBacklinks,
                internalLinkCandidates: options.internalLinkCandidates || []
            });
            lastContent = fixFrontmatterStructure(newContent);
        }

        versionNum++;
        attempt++;
    }

    // Flag article if not passed
    if (status !== 'passed') {
        await prisma.article.update({ where: { id: articleId }, data: { status: 'flagged' } });
    }

    return {
        versionId: finalVersionId,
        versionNum: finalVersionNum,
        content: lastContent,
        qcResult: finalQCResult,
        inferred: inferredFromContent,
        status
    };
}

/**
 * Create a new article and its first version (QC'd, not selected), per new pipeline:
 * 1) Infer details with Gemini when custom prompt provided
 * 2) Generate blog with specified provider/model
 * 3) QC + infer with Gemini
 * 4) Retry generation on failure
 */
async function createArticleWithVersion(meta, genParams, maxRetries = 3) {
    const {
        userPrompt,
        isCustomPrompt = false,
        internalLinkEnabled = false,
        noExternalBacklinks = true,
        niche,
        keyword,
        topic,
        n = 3,
        model = 'gemini-2.5-flash',
        provider = 'gemini'
    } = genParams || {};

    console.log('Step 1: Infer details');
    // 1. Infer details when custom prompt provided (Gemini only)
    let inferred = { anchorText: '', backlinkUrl: '', niche: '', keyword: '', topic: '' };
    if (isCustomPrompt && userPrompt) {
        inferred = await inferArticleDetails({ userPrompt, model: 'gemini-2.5-flash', provider: 'gemini' });
    }

    console.log('Inferred details: ', inferred);

    // Normalize meta for generation/QC
    const normalized = {
        niche: inferred.niche || niche || meta.niche || '',
        keyword: inferred.keyword || keyword || meta.keyword || '',
        topic: inferred.topic || topic || meta.topic || '',
        n,
        targetURL: noExternalBacklinks ? '' : (inferred.backlinkUrl || genParams.targetURL || ''),
        anchorText: noExternalBacklinks ? '' : (inferred.anchorText || genParams.anchorText || ''),
        model,      // Generation model only
        provider,   // Generation provider only
        userPrompt,
        noExternalBacklinks: !!noExternalBacklinks
    };

    // console.log('Normalized meta: ', normalized);

    // Build initial slug from inferred topic or provided slug
    const baseTitle = normalized.topic || meta.slug || 'untitled-article';
    const baseSlug = slugify(baseTitle);
    const uniqueSlug = await getUniqueArticleSlug(baseSlug);

    console.log('Base title: ', baseTitle);
    // console.log('Base slug: ', baseSlug);
    // console.log('Unique slug: ', uniqueSlug);

    // Extract domain_id from meta and remove it from the data object
    const { domain_id, ...articleData } = meta;

    // 2. Create article doc (outside tx)
    const article = await prisma.article.create({
        data: {
            ...articleData,
            slug: uniqueSlug,
            status: meta.status || 'draft',
            // External backlinks disabled by default for admin flows
            anchor: noExternalBacklinks ? undefined : normalized.anchorText,
            backlink_target: noExternalBacklinks ? undefined : normalized.targetURL,
            keyword: normalized.keyword,
            niche: normalized.niche,
            topic: normalized.topic,
            domain: domain_id ? { connect: { id: domain_id } } : undefined,
        }
    });

    // 3. Prepare internal link candidates if enabled
    const internalLinkCandidates = internalLinkEnabled && domain_id
        ? await getInternalLinkCandidates(domain_id, article.id)
        : [];

    console.log('\n\nStep 2: Generate markdown');

    // 4. Generate markdown (specified provider/model only)
    const rawContent = await generateMarkdown({
        ...normalized,
        internalLinkCandidates
    });

    const content = fixFrontmatterStructure(rawContent);
    console.log('Final Content: ', content);

    console.log('Step 3: Extract article details');
    // 5. Extract article details from output and enrich from inference using Gemini
    const fmDetails = extractArticleDetails(content);
    const inferredFromContent = await inferArticleDetails({ articleText: content, model: 'gemini-2.5-flash', provider: 'gemini' });
    console.log('Inferred from content: ', inferredFromContent);

    const articleDetails = {
        title: fmDetails.title,
        author: fmDetails.author,
        pubDate: fmDetails.pubDate,
        description: fmDetails.description,
        tags: fmDetails.tags,
        image: fmDetails.image,
        anchorText: noExternalBacklinks ? '' : inferredFromContent.anchorText,
        backlinkUrl: noExternalBacklinks ? '' : inferredFromContent.backlinkUrl,
        keyword: inferredFromContent.keyword || normalized.keyword,
        niche: inferredFromContent.niche || normalized.niche,
        topic: inferredFromContent.topic || normalized.topic
    };

    console.log('Article details: ', articleDetails);

    // 6. Update article with extracted details (ensure unique slug)
    const proposedSlug = slugify(articleDetails.title || article.topic || article.slug);
    const uniqueUpdatedSlug = await getUniqueArticleSlugExcludingId(proposedSlug, article.id);
    await prisma.article.update({
        where: { id: article.id },
        data: {
            topic: articleDetails.topic || article.topic,
            slug: uniqueUpdatedSlug,
            anchor: noExternalBacklinks ? undefined : articleDetails.anchorText || undefined,
            backlink_target: noExternalBacklinks ? undefined : articleDetails.backlinkUrl || undefined,
            keyword: articleDetails.keyword || article.keyword,
            niche: articleDetails.niche || article.niche
        }
    });

    // 7. QC loop (pass-only versions) with Gemini for QC/infer
    const qcResult = await performQC(article.id, content, maxRetries, {
        model, // used for generation retries only
        provider,
        userPrompt,
        noExternalBacklinks: !!noExternalBacklinks,
        internalLinkCandidates
    });

    return {
        articleId: article.id,
        ...qcResult
    };
}

/**
 * Create a new version for an existing article (QC'd, not selected) per new pipeline.
 */
async function createVersionForArticle(articleId, genParams, maxRetries = 3) {
    const article = await getArticle(articleId);
    if (!article) throw new Error('Article not found');

    const {
        userPrompt,
        isCustomPrompt = false,
        internalLinkEnabled = false,
        noExternalBacklinks = true,
        niche = article.niche,
        keyword = article.keyword,
        topic = article.topic,
        n = 3,
        model = 'gemini-2.5-flash',
        provider = 'gemini'
    } = genParams || {};

    // Infer from user prompt when applicable (Gemini only)
    let inferred = { anchorText: '', backlinkUrl: '', niche: '', keyword: '', topic: '' };
    if (isCustomPrompt && userPrompt) {
        inferred = await inferArticleDetails({ userPrompt, model: 'gemini-2.5-flash', provider: 'gemini' });
    }

    const normalized = {
        niche: inferred.niche || niche || '',
        keyword: inferred.keyword || keyword || '',
        topic: inferred.topic || topic || '',
        n,
        targetURL: noExternalBacklinks ? '' : (inferred.backlinkUrl || genParams.targetURL || ''),
        anchorText: noExternalBacklinks ? '' : (inferred.anchorText || genParams.anchorText || ''),
        model,      // generation only
        provider,   // generation only
        userPrompt,
        noExternalBacklinks: !!noExternalBacklinks
    };

    // Internal link candidates
    const internalLinkCandidates = internalLinkEnabled && article.domain_id
        ? await getInternalLinkCandidates(article.domain_id, article.id)
        : [];

    // Generate content with specified model/provider
    const rawContent = await generateMarkdown({
        ...normalized,
        internalLinkCandidates
    });
    const content = fixFrontmatterStructure(rawContent);

    // Extract details and update article (Gemini inference only)
    const fmDetails = extractArticleDetails(content);
    const inferredFromContent = await inferArticleDetails({ articleText: content, model: 'gemini-2.5-flash', provider: 'gemini' });
    const proposedSlug2 = slugify(fmDetails.title || inferredFromContent.topic || article.topic || article.slug);
    const uniqueUpdatedSlug2 = await getUniqueArticleSlugExcludingId(proposedSlug2, articleId);
    await prisma.article.update({
        where: { id: articleId },
        data: {
            topic: inferredFromContent.topic || normalized.topic || article.topic,
            slug: uniqueUpdatedSlug2,
            anchor: noExternalBacklinks ? undefined : (inferredFromContent.anchorText || undefined),
            backlink_target: noExternalBacklinks ? undefined : (inferredFromContent.backlinkUrl || undefined),
            keyword: inferredFromContent.keyword || normalized.keyword || article.keyword,
            niche: inferredFromContent.niche || normalized.niche || article.niche
        }
    });

    // QC and return (Gemini QC, specified model for generation retries)
    const qcResult = await performQC(articleId, content, maxRetries, {
        model,
        provider,
        userPrompt,
        noExternalBacklinks: !!noExternalBacklinks,
        internalLinkCandidates
    });
    return qcResult;
}

/**
 * Add a blog post to a specified domain (publish). Requires selected_version_id.
 * @param {string} articleId - The article's ID
 * @param {string} domainName - The domain folder name
 * @param {Object} options - Optional configuration
 * @returns {Promise<{success: boolean, filePath: string, message: string}>}
 */
async function addBlogToDomain(articleId, domainName, options = {}) {
    try {
        // 1. Verify article exists and has selected version
        const article = await getArticle(articleId);
        if (!article) {
            throw new Error(`Article with ID ${articleId} not found`);
        }

        if (!article.selected_version_id) {
            throw new Error(`Article ${articleId} has no selected version`);
        }

        // 2. Get the selected version content
        const selectedVersion = article.versions.find(v => v.id === article.selected_version_id);
        if (!selectedVersion) {
            throw new Error(`Selected version ${article.selected_version_id} not found`);
        }

        // 3. Verify domain exists
        const domainsBase = options.domainsBase || path.resolve(__dirname, '../../../astro-builds/domains');
        const domainPath = path.join(domainsBase, domainName);

        if (!await fs.pathExists(domainPath)) {
            throw new Error(`Domain ${domainName} not found at ${domainPath}`);
        }

        // 4. Create markdown content with frontmatter
        const frontmatter = extractFrontmatter(selectedVersion.content_md);

        // 5. Validate content exists
        if (!selectedVersion.content_md || selectedVersion.content_md.trim() === '') {
            throw new Error(`Selected version ${article.selected_version_id} has no content`);
        }

        // Content is already fixed in the database, use as-is
        const markdownContent = selectedVersion.content_md;

        // 6. Create the markdown file with sanitized filename
        const sanitizedSlug = slugify(article.slug || article.topic || article.keyword);
        const fileName = `${sanitizedSlug}.md`;
        const postsDir = path.join(domainPath, 'src', 'content', 'posts');
        const filePath = path.join(postsDir, fileName);

        // Ensure posts directory exists
        await fs.ensureDir(postsDir);

        // Write the file
        await fs.writeFile(filePath, markdownContent, 'utf8');

        console.log(`✅ Blog post added to domain ${domainName}:`);
        console.log(`   📁 File: ${fileName} (sanitized from: ${article.slug})`);
        console.log(`   📍 Path: ${filePath}`);
        console.log(`   📝 Title: ${frontmatter?.title}`);
        console.log(`   📄 Content length: ${markdownContent.length} characters`);

        return {
            success: true,
            filePath: filePath,
            fileName: fileName,
            sanitizedSlug: sanitizedSlug,
            originalSlug: article.slug,
            message: `Blog post "${frontmatter?.title}" successfully added to domain ${domainName}`,
            article: {
                id: article.id,
                slug: article.slug,
                sanitizedSlug: sanitizedSlug,
                title: frontmatter?.title,
                author: frontmatter?.author,
                pubDate: frontmatter?.pubDate
            }
        };

    } catch (error) {
        console.error('❌ Error adding blog to domain:', error.message);

        let errorMessage = error.message;
        if (error.message.includes('no content')) {
            errorMessage = `Article version has no content. Please regenerate the article.`;
        } else if (error.message.includes('not found')) {
            errorMessage = `Article or version not found. Please check the article ID.`;
        } else if (error.message.includes('domain not found')) {
            errorMessage = `Domain folder not found. Please create the domain first.`;
        }

        return {
            success: false,
            filePath: null,
            fileName: null,
            message: errorMessage,
            error: error.message
        };
    }
}

/**
 * Update an already published blog post file in a domain. Requires selected_version_id.
 * - Overwrites file using current article slug; if a file with a different slug exists, it will write a new file (no implicit deletion).
 * @param {string} articleId
 * @param {string} domainName
 * @param {Object} options
 */
async function updateBlogInDomain(articleId, domainName, options = {}) {
    const article = await getArticle(articleId);
    if (!article) throw new Error(`Article with ID ${articleId} not found`);
    if (!article.selected_version_id) throw new Error(`Article ${articleId} has no selected version`);

    const selectedVersion = article.versions.find(v => v.id === article.selected_version_id);
    if (!selectedVersion) throw new Error(`Selected version ${article.selected_version_id} not found`);

    const domainsBase = options.domainsBase || path.resolve(__dirname, '../../../astro-builds/domains');
    const domainPath = path.join(domainsBase, domainName);
    if (!await fs.pathExists(domainPath)) throw new Error(`Domain ${domainName} not found at ${domainPath}`);

    const postsDir = path.join(domainPath, 'src', 'content', 'posts');
    await fs.ensureDir(postsDir);

    const sanitizedSlug = slugify(article.slug || article.topic || article.keyword);
    const fileName = `${sanitizedSlug}.md`;
    const filePath = path.join(postsDir, fileName);

    await fs.writeFile(filePath, selectedVersion.content_md, 'utf8');
    return { success: true, filePath, fileName };
}

/**
 * Create a new version from editor-provided markdown content - DIRECT EDIT VERSION
 * - Simply saves the content as-is without AI processing
 * - Minimal frontmatter processing
 * - No QC, no content inference
 * - Does NOT select the version automatically
 * @param {string} articleId
 * @param {string} contentMd
 * @returns {Promise<{versionId: string, versionNum: number, content: string}>}
 */
async function createVersionFromEditorDirect(articleId, contentMd) {
    const article = await getArticle(articleId);
    if (!article) throw new Error('Article not found');

    // Just fix basic frontmatter structure, no AI processing
    const fixed = fixFrontmatterStructure(contentMd);

    // Process images in the content
    console.log('Processing images in edited content...');
    let contentWithImages;
    try {
        contentWithImages = await insertImages(fixed);
        console.log('Images processed successfully');
    } catch (imageError) {
        console.warn('Image processing failed, using original content:', imageError.message);
        contentWithImages = fixed;
    }

    // Create the new version directly
    const nextVersionNum = Math.max(...(article.versions?.map(v => v.version_num) || [0])) + 1;
    
    const newVersion = await prisma.articleVersion.create({
        data: {
            article_id: articleId,
            version_num: nextVersionNum,
            content_md: contentWithImages,
            qc_attempts: 0,
            last_qc_status: 'DIRECT_EDIT',
            last_qc_notes: { message: 'Direct edit - no QC performed' },
            prompt: 'DIRECT_EDIT'
        }
    });

    return {
        versionId: newVersion.id,
        versionNum: newVersion.version_num,
        content: contentWithImages,
        qcResult: null,
        status: 'DIRECT_EDIT'
    };
}

/**
 * Create a new version from editor-provided markdown content.
 * - Fixes frontmatter, updates article fields from content
 * - QC run (single attempt) and pass-only version creation
 * - Does NOT select the version automatically
 * @param {string} articleId
 * @param {string} contentMd
 * @param {Object} options - { model?, provider? }
 */
async function createVersionFromEditor(articleId, contentMd, options = {}) {
    const article = await getArticle(articleId);
    if (!article) throw new Error('Article not found');

    const model = options.model || 'gemini-2.5-flash';
    const provider = options.provider || 'gemini';

    // Normalize/fix markdown
    const fixed = fixFrontmatterStructure(contentMd);

    // Extract details and update article (no external backlinks in admin flows)
    const fmDetails = extractArticleDetails(fixed);
    const inferredFromContent = await inferArticleDetails({ articleText: fixed, model, provider });

    await prisma.article.update({
        where: { id: articleId },
        data: {
            topic: inferredFromContent.topic || fmDetails.title || article.topic,
            slug: slugify(fmDetails.title || inferredFromContent.topic || article.slug),
            // Do not store external backlinks for admin/editor flows
            anchor: undefined,
            backlink_target: undefined,
            keyword: inferredFromContent.keyword || article.keyword,
            niche: inferredFromContent.niche || article.niche
        }
    });

    // QC once, pass-only version
    const qcResult = await performQC(articleId, fixed, 1, {
        model,
        provider,
        userPrompt: 'EDITOR_UPDATE',
        noExternalBacklinks: true,
        internalLinkCandidates: []
    });

    return qcResult;
}


module.exports = {
    performQC,
    createArticleWithVersion,
    createVersionForArticle,
    addBlogToDomain,
    updateBlogInDomain,
    createVersionFromEditor,
    createVersionFromEditorDirect
};