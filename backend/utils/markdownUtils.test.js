const { fixFrontmatterStructure } = require('./markdownUtils');

function run() {
  const input = `---
pubDate: 2025-08-10
author: Sophia Rodriguez
title: Clutter Clear Your Mind Revolutionizing Productivity with Clutter Clear Software
description: "..."
---
image:
  alt: "Clutter Clear dashboard with activity graph and task cards"
  url: "https://example.com/header.png"

# Body Title
Content here.
`;

  const out = fixFrontmatterStructure(input, { image: { alt: 'Header image' } });
  if (!/^---\s*[\s\S]*?\n---\n/.test(out)) {
    console.error('Frontmatter block not properly closed.');
    process.exit(1);
  }
  const fm = out.match(/^---\s*\n([\s\S]*?)\n---/)[1];
  if (!/^image:\n\s+alt:\s+"[^"]+"\n\s+url:\s+"[^"]*"/m.test(fm)) {
    console.error('Image alt/url not present in frontmatter.');
    process.exit(1);
  }
  console.log('OK');
}

if (require.main === module) run();

module.exports = { run }; 