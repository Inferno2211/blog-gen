const prisma = require('../db/prisma');


async function getUniqueArticleSlug(baseSlug) {
    let slug = baseSlug;
    let count = 1;
    while (await prisma.article.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${count++}`;
    }
    return slug;
}

async function getUniqueArticleSlugExcludingId(baseSlug, excludeArticleId) {
    let slug = baseSlug;
    let count = 1;
    // Allow the same slug if it belongs to the excluded article ID
    /* eslint-disable no-constant-condition */
    while (true) {
        const existing = await prisma.article.findUnique({ where: { slug } });
        if (!existing || existing.id === excludeArticleId) {
            return slug;
        }
        slug = `${baseSlug}-${count++}`;
    }
}

module.exports = {
    getUniqueArticleSlug,
    getUniqueArticleSlugExcludingId
};