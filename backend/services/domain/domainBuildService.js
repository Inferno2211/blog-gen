const { exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const archiver = require('archiver');
const slugify = require('slugify');
const staticGen = require('./staticGen');

const DOMAINS_BASE = path.resolve(__dirname, '../../../astro-builds/domains');

async function buildDomain(domainName) {
  const domainPath = path.join(DOMAINS_BASE, domainName);
  if (!await fs.pathExists(domainPath)) {
    const err = new Error('Astro project directory not found');
    err.status = 404;
    throw err;
  }
  const packageJsonPath = path.join(domainPath, 'package.json');
  if (!await fs.pathExists(packageJsonPath)) {
    const err = new Error('package.json not found in Astro project');
    err.status = 404;
    throw err;
  }

  const buildCommand = process.platform === 'win32' ? 'npm.cmd run build' : 'npm run build';
  return new Promise((resolve, reject) => {
    exec(buildCommand, { cwd: domainPath }, async (error, stdout, stderr) => {
      if (error) {
        const err = new Error(`Build failed: ${error.message}`);
        err.status = 500;
        err.stderr = stderr;
        return reject(err);
      }
      const distPath = path.join(domainPath, 'dist');
      if (!await fs.pathExists(distPath)) {
        const err2 = new Error('Build completed but dist folder not found');
        err2.status = 500;
        return reject(err2);
      }
      resolve({ stdout });
    });
  });
}

async function downloadDomain(domainName, resStream) {
  const domainPath = path.join(DOMAINS_BASE, domainName);
  const distPath = path.join(domainPath, 'dist');
  if (!await fs.pathExists(distPath)) {
    const err = new Error('No built site found. Please run build first.');
    err.status = 404;
    throw err;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = slugify(`${domainName}-${timestamp}`, { lower: true, strict: true }) + '.zip';
  resStream.setHeader('Content-Type', 'application/zip');
  resStream.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', err => reject(err));
    archive.on('end', () => resolve({ filename }));
    archive.pipe(resStream);
    archive.directory(distPath, false);
    archive.finalize();
  });
}

async function getDomainStatus(domainName) {
  const domainPath = path.join(DOMAINS_BASE, domainName);
  if (!await fs.pathExists(domainPath)) {
    const err = new Error(`Domain '${domainName}' not found`);
    err.status = 404;
    throw err;
  }
  const hasNodeModules = await fs.pathExists(path.join(domainPath, 'node_modules'));
  const hasDist = await fs.pathExists(path.join(domainPath, 'dist'));
  const domainInfo = await staticGen.getDomainInfo(domainName);
  const postsDir = path.join(domainPath, 'src', 'content', 'posts');
  let postCount = 0;
  if (await fs.pathExists(postsDir)) {
    const posts = await fs.readdir(postsDir);
    postCount = posts.filter(f => f.endsWith('.md')).length;
  }
  return {
    domainName,
    status: {
      exists: true,
      hasNodeModules,
      hasDist,
      postCount,
      layout: domainInfo.layout,
      lastModified: domainInfo.lastModified
    }
  };
}

module.exports = { buildDomain, downloadDomain, getDomainStatus };
