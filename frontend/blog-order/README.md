# Blog Creation Frontend

A React-based frontend for creating blogs using AI generation.

## Features

- Responsive form interface for blog creation
- Real-time validation
- Loading states and error handling
- Success response display with generated content preview
- TypeScript support with proper type definitions

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
VITE_REACT_APP_API_URL=http://localhost:3000
VITE_REACT_APP_API_VERSION=1
```

3. Start the development server:
```bash
npm run dev
```

## API Integration

The frontend integrates with the blog creation API endpoint:
- **URL**: `${VITE_REACT_APP_API_URL}/v${VITE_REACT_APP_API_VERSION}/ai/generate`
- **Method**: POST
- **Content-Type**: application/json

### Request Body
```json
{
  "niche": "string",
  "keyword": "string", 
  "topic": "string",
  "n": "number",
  "targetURL": "string",
  "anchorText": "string",
  "model": "gemini-2.5-flash"
}
```

### Response Format
```json
{
  "success": "boolean",
  "markdown": "string",
  "files": {
    "backend": "string",
    "astro": "string"
  },
  "articleId": "string",
  "databaseEntry": {
    "id": "string",
    "slug": "string", 
    "title": "string",
    "status": "string",
    "versionId": "string"
  }
}
```

## Project Structure

```
src/
├── components/
│   └── BlogCreationForm.tsx    # Main form component
├── services/
│   └── blogService.ts          # API service layer
├── types/
│   └── blog.ts                 # TypeScript interfaces
├── App.tsx                     # Main app component
└── main.tsx                    # Entry point
```

## Technologies Used

- React 19
- TypeScript
- Tailwind CSS
- Vite

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
