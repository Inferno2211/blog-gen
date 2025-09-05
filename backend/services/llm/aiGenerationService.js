const slugify = require('slugify');
const { createArticleWithVersion, createVersionForArticle } = require('../articles/coreServices');
const { getArticle } = require('../articles/dbCrud');

/**
 * Generate a brand new article (with initial QC'd version)
 * @param {Object} body - Raw request body from controller
 * @returns {Promise<Object>} result structure expected by client
 */
async function generateArticle(body) {
  const {
    domain_id, status, user,
    niche, keyword, topic, n, targetURL, anchorText, model, provider,
    maxRetries = 3,
    userPrompt,
    internalLinkEnabled = false,
    noExternalBacklinks = true
  } = body;

  if (!userPrompt && (!niche && !keyword && !topic && !n && !targetURL && !anchorText)) {
    const err = new Error('Missing required fields: userPrompt, niche, keyword, topic, n, targetURL, anchorText');
    err.status = 400;
    throw err;
  }

  const slug = slugify(topic || '') || 'untitled-article';
  const meta = { domain_id, slug, status, user };
  const genParams = {
    niche, keyword, topic, n, targetURL, anchorText, model, provider, userPrompt,
    isCustomPrompt: !!userPrompt,
    internalLinkEnabled: !!internalLinkEnabled,
    noExternalBacklinks: !!noExternalBacklinks
  };

  const temp = await createArticleWithVersion(meta, genParams, maxRetries);
  return {
    articleId: temp.articleId,
    draft: {
      versionId: temp.versionId,
      versionNum: temp.versionNum,
      content: temp.content,
      qcResult: temp.qcResult
    },
    status: temp.status
  };
}

/**
 * Generate a new version for an existing article
 * @param {Object} body - Raw request body
 */
async function generateArticleVersion(body) {
  const { articleId, provider = 'gemini', maxRetries = 3, userPrompt, internalLinkEnabled = false, noExternalBacklinks = true } = body;
  if (!articleId) {
    const err = new Error('Missing required fields: articleId');
    err.status = 400;
    throw err;
  }
  const article = await getArticle(articleId);
  if (!article) {
    const err = new Error('Article not found');
    err.status = 404;
    throw err;
  }

  const genParams = {
    niche: article.niche,
    keyword: article.keyword,
    topic: article.topic,
    n: 3,
    targetURL: article.backlink_target,
    anchorText: article.anchor,
    provider,
    userPrompt,
    isCustomPrompt: !!userPrompt,
    internalLinkEnabled: !!internalLinkEnabled,
    noExternalBacklinks: !!noExternalBacklinks
  };

  const result = await createVersionForArticle(articleId, genParams, maxRetries);
  return {
    articleId,
    draft: {
      versionId: result.versionId,
      versionNum: result.versionNum,
      content: result.content,
      qcResult: result.qcResult
    },
    status: result.status
  };
}

module.exports = { generateArticle, generateArticleVersion };
