# Article Browse and Availability API Documentation

This document describes the new public API endpoints for article browsing and availability checking, implemented as part of the article backlink purchase system.

## Endpoints

### GET /api/v1/articles/browse

**Description**: Retrieves a list of published articles with preview information for homepage display.

**Authentication**: None required (public endpoint)

**Response Format**:
```json
{
  "articles": [
    {
      "id": "string",
      "slug": "string", 
      "title": "string",
      "preview": "string",
      "availability_status": "AVAILABLE|SOLD_OUT|PROCESSING",
      "domain": "string",
      "niche": "string",
      "keyword": "string",
      "created_at": "ISO 8601 timestamp",
      "last_backlink_added": "ISO 8601 timestamp or null"
    }
  ],
  "total": "number",
  "timestamp": "ISO 8601 timestamp"
}
```

**Example Response**:
```json
{
  "articles": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "slug": "best-practices-web-development",
      "title": "Best Practices for Modern Web Development",
      "preview": "In today's rapidly evolving web landscape, developers need to stay current with the latest best practices...",
      "availability_status": "AVAILABLE",
      "domain": "Tech Blog",
      "niche": "Technology",
      "keyword": "web development",
      "created_at": "2024-01-15T10:30:00.000Z",
      "last_backlink_added": null
    }
  ],
  "total": 1,
  "timestamp": "2024-01-15T14:22:33.123Z"
}
```

**Status Codes**:
- `200 OK`: Successfully retrieved articles
- `500 Internal Server Error`: Database or server error

---

### GET /api/v1/articles/:id/availability

**Description**: Checks the real-time availability status of a specific article for backlink purchase.

**Authentication**: None required (public endpoint)

**Parameters**:
- `id` (path parameter): The UUID of the article to check

**Response Format**:
```json
{
  "articleId": "string",
  "available": "boolean",
  "reason": "string (optional)",
  "timestamp": "ISO 8601 timestamp"
}
```

**Example Responses**:

Available article:
```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "available": true,
  "timestamp": "2024-01-15T14:22:33.123Z"
}
```

Unavailable article:
```json
{
  "articleId": "123e4567-e89b-12d3-a456-426614174000",
  "available": false,
  "reason": "Article sold out - backlink pending review",
  "timestamp": "2024-01-15T14:22:33.123Z"
}
```

Non-existent article:
```json
{
  "articleId": "non-existent-id",
  "available": false,
  "reason": "Article not found",
  "timestamp": "2024-01-15T14:22:33.123Z"
}
```

**Availability Reasons**:
- `"Article not found"`: Article ID does not exist
- `"Article not published"`: Article exists but is not published
- `"Article sold out - backlink pending review"`: Article has a backlink pending admin review
- `"Article currently being processed"`: Article is being processed for backlink integration

**Status Codes**:
- `200 OK`: Successfully checked availability (even if article not found)
- `500 Internal Server Error`: Database or server error

## Implementation Details

### Article Preview Generation

The browse endpoint automatically generates article previews with the following logic:

1. **Title Extraction**: 
   - Uses the first `# heading` from markdown content
   - Falls back to the article's `topic` field if no heading found
   - Defaults to "Untitled Article" if neither available

2. **Preview Text**:
   - Extracts the first paragraph after the title
   - Removes markdown formatting (*, _, #, etc.)
   - Truncates to 200 characters with "..." if longer
   - Falls back to "No preview available" if no content

3. **Availability Status**:
   - `AVAILABLE`: Article can accept new backlink purchases
   - `SOLD_OUT`: Article has a backlink pending admin review
   - `PROCESSING`: Article is currently being processed

### Database Integration

These endpoints integrate with the existing article system:

- Only `PUBLISHED` articles are returned in browse results
- Availability is determined by `availability_status` field and article status
- Preview generation uses the article's `selected_version` content
- Domain information is included from the related `Domain` model

### Performance Considerations

- Browse endpoint uses optimized database queries with selective field loading
- Preview generation is performed in-memory for better performance
- No authentication overhead for public endpoints
- Responses include timestamps for caching strategies

## Testing

Use the provided test script to verify endpoint functionality:

```bash
# Start the server
npm start

# In another terminal, run the test script
node test-browse-endpoints.js
```

The test script will verify:
- Browse endpoint returns proper structure
- Availability endpoint handles both existing and non-existent articles
- Response formats match the documented schema