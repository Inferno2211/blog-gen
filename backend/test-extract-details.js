const { extractArticleDetails } = require('./utils/markdownUtils');

function testExtractArticleDetails() {
    console.log('Testing article details extraction...');
    
    const testMarkdown = `---
pubDate: 2023-10-05
author: Sarah Thompson
title: Clutter Clear Transform Your Workflow with Productivity Software
description: "Clutter Clear helps you streamline tasks and boost productivity with intuitive tools."
image:
  alt: "Person using Clutter Clear on laptop for task management."
  url: "https://picsum.photos/1280/720"
tags: ["Clutter Clear", "Productivity Tools"]
---

# Clutter Clear: Transform Your Workflow with Productivity Software

This is the article content...
`;

    const details = extractArticleDetails(testMarkdown);
    
    console.log('\n=== EXTRACTED DETAILS ===');
    console.log('Title:', details.title);
    console.log('Author:', details.author);
    console.log('PubDate:', details.pubDate);
    console.log('Description:', details.description);
    console.log('Tags:', details.tags);
    console.log('Image URL:', details.image.url);
    console.log('Image Alt:', details.image.alt);
    console.log('=== END DETAILS ===\n');
    
    return details;
}

// Only run if this file is executed directly
if (require.main === module) {
    testExtractArticleDetails();
}

module.exports = { testExtractArticleDetails }; 