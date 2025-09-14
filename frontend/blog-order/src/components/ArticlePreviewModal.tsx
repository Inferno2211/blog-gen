import { useState, useEffect } from 'react';
import { X, ExternalLink, User, Calendar, Tag } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PublicArticle } from '../types/purchase';
import { getArticleContent } from '../services/purchaseService';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface ArticleFrontmatter {
  title?: string;
  description?: string;
  author?: string;
  pubDate?: string;
  image?: string;
  keywords?: string[];
}

interface ArticlePreviewModalProps {
  article: PublicArticle;
  onClose: () => void;
}

export default function ArticlePreviewModal({ article, onClose }: ArticlePreviewModalProps) {
  const [content, setContent] = useState<string>('');
  const [frontmatter, setFrontmatter] = useState<ArticleFrontmatter>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticleContent();
  }, [article.id]);

  const parseFrontmatter = (content: string): { frontmatter: ArticleFrontmatter; content: string } => {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      return { frontmatter: {}, content };
    }

    const [, frontmatterText, bodyContent] = frontmatterMatch;
    const frontmatter: ArticleFrontmatter = {};

    // Parse YAML-like frontmatter
    const lines = frontmatterText.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      switch (key) {
        case 'title':
          frontmatter.title = value;
          break;
        case 'description':
          frontmatter.description = value;
          break;
        case 'author':
          frontmatter.author = value;
          break;
        case 'pubDate':
          frontmatter.pubDate = value;
          break;
        case 'image':
          frontmatter.image = value;
          break;
        case 'keywords':
          // Handle keywords as array or comma-separated string
          if (value.startsWith('[') && value.endsWith(']')) {
            frontmatter.keywords = value.slice(1, -1).split(',').map(k => k.trim().replace(/['"]/g, ''));
          } else {
            frontmatter.keywords = value.split(',').map(k => k.trim());
          }
          break;
      }
    }

    return { frontmatter, content: bodyContent };
  };

  const loadArticleContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const articleContent = await getArticleContent(article.id);
      
      const { frontmatter: parsedFrontmatter, content: cleanContent } = parseFrontmatter(articleContent);
      
      setFrontmatter(parsedFrontmatter);
      setContent(cleanContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b bg-gray-50">
          <div className="flex items-center justify-between p-4 sm:p-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {frontmatter.title || article.title}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {article.domain} • Published {frontmatter.pubDate ? new Date(frontmatter.pubDate).toLocaleDateString() : new Date(article.created_at).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Article metadata */}
          {!loading && !error && (frontmatter.description || frontmatter.author || frontmatter.keywords) && (
            <div className="px-4 sm:px-6 pb-4 space-y-3">
              {frontmatter.description && (
                <p className="text-sm text-gray-700 italic">
                  {frontmatter.description}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                {frontmatter.author && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{frontmatter.author}</span>
                  </div>
                )}
                
                {frontmatter.pubDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(frontmatter.pubDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              
              {frontmatter.keywords && frontmatter.keywords.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-3 h-3 text-gray-500" />
                  <div className="flex flex-wrap gap-1">
                    {frontmatter.keywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorMessage message={error} onRetry={loadArticleContent} />
            </div>
          ) : (
            <div className="p-4 sm:p-6">
              {/* Featured image if available */}
              {frontmatter.image && (
                <div className="mb-6">
                  <img
                    src={frontmatter.image}
                    alt={frontmatter.title || article.title}
                    className="w-full h-48 sm:h-64 object-cover rounded-lg"
                    onError={(e) => {
                      // Hide image if it fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="prose prose-sm sm:prose max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || 'No content available for preview.'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-gray-50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">$15</span> per backlink • 
              Status: <span className={`font-medium ${
                article.availability_status === 'AVAILABLE' ? 'text-green-600' : 
                article.availability_status === 'SOLD_OUT' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {article.availability_status === 'AVAILABLE' ? 'Available' : 
                 article.availability_status === 'SOLD_OUT' ? 'Sold Out' : 'Processing'}
              </span>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {article.availability_status === 'AVAILABLE' && (
                <button
                  onClick={() => {
                    onClose();
                    // This will be handled by the parent component
                    const event = new CustomEvent('openPurchaseModal', { detail: article });
                    window.dispatchEvent(event);
                  }}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Purchase Backlink
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}