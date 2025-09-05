const prisma = require('../../db/prisma');

async function createDomain(domain) {
    return await prisma.domain.create({ data: domain });
}

async function getDomain(id) {
    const domain = await prisma.domain.findUnique({
        where: { id },
        include: { articles: true }
    });
    if (!domain) return null;
    return {
        id: domain.id,
        name: domain.name,
        slug: domain.slug,
        url: domain.url,
        tags: domain.tags,
        created_at: domain.created_at,
        articleCount: domain.articles.length,
        articles: domain.articles.map(a => ({
            id: a.id,
            name: a.slug, // or a.title if available
            tag: domain.tags,
            backlink: a.backlink,
            slug: a.slug,
            status: a.status
        }))
    };
}

async function getAllDomains() {
    const domains = await prisma.domain.findMany({ include: { articles: true } });
    return domains.map(d => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        url: d.url,
        tags: d.tags,
        created_at: d.created_at,
        articleCount: d.articles.length
    }));
}

async function getAllDomainsWithArticles() {
    const domains = await prisma.domain.findMany({ include: { articles: true } });
    return domains.map(d => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        url: d.url,
        tags: d.tags,
        created_at: d.created_at,
        articles: d.articles.map(a => ({
            id: a.id,
            slug: a.slug,
            topic: a.topic,
            status: a.status
        })),
        articleCount: d.articles.length
    }));
}

async function updateDomain(id, data) {
    return await prisma.domain.update({ where: { id }, data });
}

async function bulkCreateDomains(domains, tags) {
    const results = [];
    for (const d of domains) {
        try {
            const domainData = {
                name: d.name || d,
                slug: d.slug || d.name?.toLowerCase().replace(/\s+/g, '-') || d.toLowerCase().replace(/\s+/g, '-'),
                url: d.url || '',
                tags: Array.isArray(tags) ? tags.join(',') : tags || '',
            };
            const created = await createDomain(domainData);
            results.push({ domain: domainData.slug, success: true, id: created.id });
        } catch (err) {
            let errorMessage = 'Unknown error occurred';
            if (err.code === 'P2002') {
                errorMessage = `Domain with slug '${d.slug || d.name || d}' already exists`;
            } else if (err.message.includes('Invalid')) {
                errorMessage = `Invalid data for domain '${d.name || d}': ${err.message}`;
            } else if (err.message.includes('required')) {
                errorMessage = `Missing required fields for domain '${d.name || d}': ${err.message}`;
            } else {
                errorMessage = err.message;
            }
            results.push({ domain: d.name || d, success: false, error: errorMessage });
        }
    }
    return results;
}

// Delete domain only if it has no associated articles (business rule reflected in docs)
async function deleteDomain(id) {
    // Ensure domain exists and check article count
    const domain = await prisma.domain.findUnique({
        where: { id },
        include: { articles: { select: { id: true } } }
    });
    if (!domain) return null; // caller will treat as 404

    if (domain.articles.length > 0) {
        // Throw explicit error message used by controller to map to 409
        throw new Error('foreign key constraint - domain has associated articles');
    }

    const deleted = await prisma.domain.delete({ where: { id } });
    return {
        id: deleted.id,
        name: deleted.name,
        slug: deleted.slug,
        url: deleted.url,
        tags: deleted.tags,
        created_at: deleted.created_at
    };
}

module.exports = {
    createDomain,
    getDomain,
    getAllDomains,
    getAllDomainsWithArticles,
    updateDomain,
    deleteDomain,
    bulkCreateDomains
};
