# Astro Template System

A flexible system for creating and managing multiple Astro-based websites with instant template switching capabilities.

## 🏗️ Architecture

```
astro-builds/
├── templates/           # Central template repository
│   ├── microblog-main/  # Full-featured blog template
│   ├── minimal-blog/    # Simple blog template
│   ├── empty-template/  # Bare-bones starter template
│   └── template-config.json
├── domains/            # Generated domain websites
│   ├── domain1/        # Each domain is a complete Astro project
│   ├── domain2/
│   └── ...
└── demo-template-system.js
```

## 📋 Available Templates

### 1. **microblog-main**
- **Description**: Full-featured microblog with dynamic layout switching
- **Features**: RSS feed, sitemap, tag system, multiple layouts
- **Best for**: Content-heavy blogs with advanced features

### 2. **minimal-blog**
- **Description**: Clean, simple blog template
- **Features**: Basic content management, responsive design
- **Best for**: Simple blogs and content sites

### 3. **empty-template**
- **Description**: Bare-bones Astro template
- **Features**: Minimal setup, ready for customization
- **Best for**: Custom development projects

## 🚀 Quick Start

### 1. Create a New Domain

```javascript
const { createDomainFolder } = require('./backend/services/domain/staticGen');

// Create a new domain with microblog template
await createDomainFolder('my-website', 'microblog-main');
```

### 2. Switch Templates

```javascript
const { switchDomainTemplate } = require('./backend/services/domain/staticGen');

// Switch to a different template (preserves content)
await switchDomainTemplate('my-website', 'minimal-blog');
```

### 3. Run the Demo

```bash
cd astro-builds
node demo-template-system.js
```

## 🔧 API Reference

### `createDomainFolder(domainName, templateName, options)`
Creates a new domain folder by copying a template.

**Parameters:**
- `domainName` (string): Name of the domain folder
- `templateName` (string): Template to use
- `options` (object): Optional configuration

**Returns:** Promise<string> - Path to created domain

### `switchDomainTemplate(domainName, newTemplateName, options)`
Switches a domain to use a different template while preserving content.

**Parameters:**
- `domainName` (string): Domain to switch
- `newTemplateName` (string): New template to use
- `options` (object): Optional configuration

**Returns:** Promise<string> - Path to updated domain

### `getAvailableTemplates(options)`
Lists all available templates.

**Returns:** Promise<Array> - Array of template names

### `listDomains(options)`
Lists all created domains.

**Returns:** Promise<Array> - Array of domain information

### `getDomainInfo(domainName, options)`
Gets information about a specific domain.

**Returns:** Promise<object> - Domain configuration

## 📁 Template Structure

Each template should follow this structure:

```
template-name/
├── package.json          # Dependencies and scripts
├── astro.config.mjs      # Astro configuration
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── src/
    ├── env.d.ts          # Environment types
    ├── styles/
    │   └── global.css    # Global styles
    ├── layouts/          # Layout components
    ├── pages/            # Page components
    ├── components/       # Reusable components
    └── content/          # Content collections
```

## 🎨 Adding New Templates

1. **Create Template Folder**
   ```bash
   mkdir astro-builds/templates/my-new-template
   ```

2. **Add Required Files**
   - `package.json` with Astro dependencies
   - `astro.config.mjs` with your configuration
   - `src/` directory with your components

3. **Update Template Config**
   Add your template to `astro-builds/templates/template-config.json`:

   ```json
   {
     "templates": {
       "my-new-template": {
         "name": "My New Template",
         "description": "Description of your template",
         "features": ["Feature 1", "Feature 2"],
         "category": "blog",
         "defaultLayout": "BaseLayout"
       }
     }
   }
   ```

## 🔄 Template Switching Process

When switching templates:

1. **Content Backup**: Current content is backed up
2. **Template Copy**: New template files are copied
3. **Content Restoration**: Original content is restored
4. **Config Update**: Domain configuration is updated

This ensures your content is preserved while changing the design and functionality.

## 🛠️ Development Workflow

### For Template Development:
1. Create/modify templates in `astro-builds/templates/`
2. Test templates by creating test domains
3. Update template configuration

### For Domain Management:
1. Create domains using `createDomainFolder()`
2. Switch templates using `switchDomainTemplate()`
3. Manage content through the domain's content directory

## 📝 Example Usage

```javascript
const staticGen = require('./backend/services/domain/staticGen');

async function createMyWebsite() {
    try {
        // Create a new website
        await staticGen.createDomainFolder('my-blog', 'microblog-main');
        
        // Add some content
        await staticGen.addBlogToDomain('my-blog', 'first-post.md', '# My First Post\n\nWelcome to my blog!');
        
        // Switch to a different template later
        await staticGen.switchDomainTemplate('my-blog', 'minimal-blog');
        
        console.log('Website created and configured!');
    } catch (error) {
        console.error('Error:', error.message);
    }
}
```

## 🎯 Benefits

- **Content Separation**: Content is independent of layout
- **Instant Switching**: Change templates without losing content
- **Scalable**: Easy to add new templates
- **Multi-tenant**: Perfect for managing multiple websites
- **Flexible**: Each domain is a complete Astro project

## 🚨 Important Notes

- Always backup your content before switching templates
- Test templates thoroughly before using in production
- Each domain is a complete Astro project that can be built independently
- Template switching preserves content but may require manual adjustments for complex layouts

## 📞 Support

For issues or questions about the template system, check the individual template READMEs or the main project documentation. 