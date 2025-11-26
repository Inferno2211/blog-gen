const express = require('express');
const router = express.Router();

const aiRouter = require('./ai/index.js');
const domainRouter = require('./domain/domain.js');
const articlesRouter = require('./articles/articles.js');
const authRouter = require('./auth/auth.js');
const purchaseRouter = require('./purchase/purchase.js');
const generationRouter = require('./generation/generation.js');
const logsRouter = require('./logs/logs.js');
// const ssgRouter = require('./ssg/index.js');

router.use('/ai', aiRouter);
router.use('/domain', domainRouter);
router.use('/articles', articlesRouter);
router.use('/auth', authRouter);
router.use('/purchase', purchaseRouter);
router.use('/generation', generationRouter);
router.use('/logs', logsRouter);
// router.use('/ssg', ssgRouter);

module.exports = router;
