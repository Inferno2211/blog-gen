# Domain Management API Documentation

## Base URL
```
http://localhost:3000/api/v1/domain
```

## Overview
This API provides comprehensive domain management capabilities including CRUD operations, template/layout management, blog operations, and utility functions.

---

## 🔧 Domain CRUD Operations

### 1. Create Domain
**POST** `/createDomain`

Creates a new domain in the database.

**Request Body:**
```json
{
  "name": "My Website",
  "slug": "my-website",
  "url": "https://mywebsite.com",
  "tags": "blog, tech, personal"
}
```

**Response:**
```json
{
  "success": true,
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "slug": "my-website"
}
```

### 2. Create Domain (Bulk)
**POST** `/createDomain`

Creates multiple domains at once.

**Request Body:**
```json
{
  "domains": [
    {
      "name": "Tech Blog",
      "slug": "tech-blog",
      "url": "https://techblog.com"
    },
    {
      "name": "Personal Blog",
      "slug": "personal-blog",
      "url": "https://personalblog.com"
    }
  ],
  "tags": "blog, tech"
}
```

**Response:**
```json
{
  "results": [
    {
      "domain": "tech-blog",
      "success": true,
      "id": "123e4567-e89b-12d3-a456-426614174000"
    },
    {
      "domain": "personal-blog",
      "success": true,
      "id": "123e4567-e89b-12d3-a456-426614174001"
    }
  ]
}
```

### 3. Get Domain by ID
**GET** `/getDomain/:id`

Retrieves a specific domain by its ID.

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "My Website",
  "slug": "my-website",
  "url": "https://mywebsite.com",
  "tags": "blog, tech, personal",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### 4. Get All Domains
**GET** `/getAllDomains`

Retrieves all domains with their associated articles.

**Response:**
```json
{
  "total": 2,
  "domains": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "My Website",
      "slug": "my-website",
      "url": "https://mywebsite.com",
      "tags": "blog, tech, personal",
      "created_at": "2024-01-01T00:00:00.000Z",
      "articles": [],
      "articleCount": 0
    }
  ]
}
```

### 5. Update Domain
**PUT** `/updateDomain/:id`

Updates an existing domain.

**Request Body:**
```json
{
  "name": "Updated Website Name",
  "url": "https://updatedwebsite.com",
  "tags": "updated, blog, tech"
}
```

### 6. Delete Domain
**DELETE** `/deleteDomain/:id`

Deletes a domain from the database.

---

## 🎨 Template/Layout Operations

### 7. Get Available Templates
**GET** `/getAvailableTemplates`

Retrieves all available layout templates.

**Response:**
```json
{
  "success": true,
  "templates": ["MicroblogLayout", "MinimalLayout", "ModernLayout"],
  "count": 3
}
```

### 8. Create Domain Folder
**POST** `/createDomainFolder`

Creates a new domain folder by copying the template.

**Request Body:**
```json
{
  "domainName": "my-new-website",
  "overwrite": false
}
```

**Parameters:**
- `domainName` (required): The name of the domain folder to create
- `overwrite` (optional): If `true`, will overwrite existing domain folder. Default: `false`

**Response:**
```json
{
  "success": true,
  "domainName": "my-new-website",
  "domainPath": "/path/to/astro-builds/domains/my-new-website",
  "overwrite": false,
  "message": "Domain 'my-new-website' created successfully!"
}
```

**Error Response (Domain Already Exists):**
```json
{
  "error": "Domain folder 'my-new-website' already exists",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 9. Switch Domain Template
**PUT** `/switchDomainTemplate`

Switches a domain to use a different layout template.

**Request Body:**
```json
{
  "domainName": "my-website",
  "newLayoutName": "MinimalLayout"
}
```

**Response:**
```json
{
  "success": true,
  "domainName": "my-website",
  "newLayoutName": "MinimalLayout",
  "configPath": "/path/to/config.json",
  "message": "Domain 'my-website' switched to 'MinimalLayout' layout!"
}
```

### 10. Get Domain Layout
**GET** `/getDomainLayout/:domainName`

Gets the current layout for a domain.

**Response:**
```json
{
  "success": true,
  "domainName": "my-website",
  "layout": "MinimalLayout"
}
```

### 11. List All Domains
**GET** `/listDomains`

Lists all domain folders with their information.

**Response:**
```json
{
  "success": true,
  "domains": [
    {
      "domainName": "my-website",
      "layout": "MinimalLayout",
      "lastModified": "2024-01-01T00:00:00.000Z",
      "configPath": "/path/to/config.json"
    }
  ],
  "count": 1
}
```

### 12. Get Domain Info
**GET** `/getDomainInfo/:domainName`

Gets detailed information about a domain.

**Response:**
```json
{
  "success": true,
  "domainInfo": {
    "domainName": "my-website",
    "layout": "MinimalLayout",
    "lastModified": "2024-01-01T00:00:00.000Z",
    "configPath": "/path/to/config.json"
  }
}
```

---

## 📝 Blog Operations

### 13. Add Blog Post to Domain (DEPRECATED)
**POST** `/addBlogToDomain`

⚠️ **DEPRECATED**: This endpoint is deprecated. Use `addArticleToDomain` instead for proper article formatting.

**Response:**
```json
{
  "error": "This endpoint is deprecated",
  "details": "Please use addArticleToDomain instead for proper article formatting with frontmatter",
  "suggestion": "Use POST /api/v1/domain/addArticleToDomain with articleId and domainName"
}
```

### 14. Add Article to Domain
**POST** `/addArticleToDomain`

Adds an article from the database to a domain as a blog post.

**Request Body:**
```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "domainName": "my-website"
}
```

**Response:**
```json
{
  "success": true,
  "filePath": "/path/to/article-slug.md",
  "fileName": "article-slug.md",
  "message": "Blog post \"Article Title\" successfully added to domain my-website",
  "article": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "slug": "article-slug",
    "title": "Article Title",
    "author": "Author Name",
    "pubDate": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 🛠️ Utility Operations

### 15. Build Domain
**POST** `/buildDomain/:domainName`

Builds the domain using npm run build (simplified approach).

**Response:**
```json
{
  "success": true,
  "message": "Domain 'my-website' built successfully!",
  "stdout": "npm run build output..."
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Build failed",
  "error": "Error details",
  "stderr": "Error output"
}
```

### 16. Download Domain
**GET** `/downloadDomain/:domainName`

Downloads the built domain as a zip file.

**Response:** Binary zip file with filename like `domain-name-2024-01-01T00-00-00.zip`

**Error Response:**
```json
{
  "success": false,
  "message": "No built site found. Please run build first."
}
```

### 17. Get Build Instructions (DEPRECATED)
**GET** `/getBuildInstructions/:domainName`

⚠️ **DEPRECATED**: This endpoint is deprecated. Use the simplified build approach instead.

### 18. Get Domain Status
**GET** `/getDomainStatus/:domainName`

Gets the current status of a domain including build status and post count.

**Response:**
```json
{
  "success": true,
  "domainName": "my-website",
  "status": {
    "exists": true,
    "hasNodeModules": true,
    "hasDist": true,
    "postCount": 5,
    "layout": "MinimalLayout",
    "lastModified": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 📋 Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing required fields)
- `404` - Not Found (domain/article not found)
- `500` - Internal Server Error

---

## 🚀 Usage Examples

### Complete Workflow Example

1. **Create Domain Folder:**
   ```bash
   POST /api/v1/domain/createDomainFolder
   {
     "domainName": "my-blog"
   }
   ```

2. **Switch Layout:**
   ```bash
   PUT /api/v1/domain/switchDomainTemplate
   {
     "domainName": "my-blog",
     "newLayoutName": "ModernLayout"
   }
   ```

3. **Add Blog Post:**
   ```bash
   POST /api/v1/domain/addBlogToDomain
   {
     "domainName": "my-blog",
     "fileName": "welcome-post.md",
     "content": "---\ntitle: \"Welcome\"\n---\n\nWelcome to my blog!"
   }
   ```

4. **Build Domain:**
   ```bash
   POST /api/v1/domain/buildDomain/my-blog
   ```

5. **Check Status:**
   ```bash
   GET /api/v1/domain/getDomainStatus/my-blog
   ```

---

## 📦 Postman Collection

Import the provided Postman collection (`Domain_API_Collection.json`) to get all endpoints with sample data pre-configured.

The collection includes:
- All 16 API endpoints
- Sample request bodies
- Environment variables
- Organized folders by operation type 