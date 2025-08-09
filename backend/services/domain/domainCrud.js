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
    // Deprecated: use getAllDomains for count-only, getDomain for details
    return getAllDomains();
}

async function updateDomain(id, data) {
    return await prisma.domain.update({ where: { id }, data });
}

async function deleteDomain(id) {
    return await prisma.domain.delete({ where: { id } });
}

module.exports = {
    createDomain,
    getDomain,
    getAllDomains,
    getAllDomainsWithArticles,
    updateDomain,
    deleteDomain
};
