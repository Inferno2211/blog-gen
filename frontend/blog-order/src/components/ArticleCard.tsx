import { useState, useEffect } from 'react';
import { Calendar, ExternalLink, ShoppingCart, AlertCircle } from 'lucide-react';
import type { PublicArticle } from '../types/purchase';
import { getArticleAvailability } from '../services/purchaseService';

interface ArticleCardProps {
  article: PublicArticle;
  onPurchaseClick: (article: PublicArticle) => void;
}

export default function ArticleCard({ article, onPurchaseClick }: ArticleCardProps) {
  const [availability, setAvailability] = useState<'AVAILABLE' | 'SOLD_OUT' | 'PROCESSING' | 'LOADING'>(article.availability_status || 'LOADING');
  const [availabilityReason, setAvailabilityReason] = useState<string>('');

  useEffect(() => {
    // Use the availability status from the article data first
    if (article.availability_status) {
      setAvailability(article.availability_status);
    } else {
      checkAvailability();
    }
  }, [article.id, article.availability_status]);

  const checkAvailability = async () => {
    try {
      const result = await getArticleAvailability(article.id);
      if (result.available) {
        setAvailability('AVAILABLE');
      } else {
        setAvailability('SOLD_OUT');
        setAvailabilityReason(result.reason || 'Currently unavailable');
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
      setAvailability('AVAILABLE'); // Default to available if check fails
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getAvailabilityBadge = () => {
    switch (availability) {
      case 'LOADING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Checking...
          </span>
        );
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Available
          </span>
        );
      case 'SOLD_OUT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Sold Out
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Processing
          </span>
        );
      default:
        return null;
    }
  };

  const isAvailable = availability === 'AVAILABLE';
  const isLoading = availability === 'LOADING';

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
            {article.title}
          </h3>
          <div className="flex-shrink-0">
            {getAvailabilityBadge()}
          </div>
        </div>
        
        {/* Article Preview */}
        <p className="text-gray-600 text-sm line-clamp-3 mb-4">
          {article.preview}
        </p>

        {/* Article Meta */}
        <div className="flex items-center text-sm text-gray-500 mb-4">
          <Calendar className="w-4 h-4 mr-1" />
          <span>Published {formatDate(article.created_at)}</span>
        </div>

        {/* Unavailability Reason */}
        {!isAvailable && availabilityReason && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
            <p className="text-sm text-gray-600">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {availabilityReason}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">$15</span> per backlink
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Preview Button */}
            <button
              className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              title="Preview article"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Preview
            </button>

            {/* Purchase Button */}
            <button
              onClick={() => onPurchaseClick(article)}
              disabled={!isAvailable || isLoading}
              className={`inline-flex items-center justify-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isAvailable && !isLoading
                  ? 'text-white bg-blue-600 hover:bg-blue-700'
                  : 'text-gray-400 bg-gray-200 cursor-not-allowed'
              }`}
            >
              <ShoppingCart className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">
                {isLoading ? 'Loading...' : isAvailable ? 'Purchase' : 'Unavailable'}
              </span>
              <span className="sm:hidden">
                {isLoading ? 'Loading...' : isAvailable ? 'Buy' : 'N/A'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}