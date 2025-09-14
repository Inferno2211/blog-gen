import { useState, useEffect } from 'react';
import type { PublicArticle } from '../types/purchase';
import ArticleCard from './ArticleCard';
import PurchaseModal from './PurchaseModal';
import ArticlePreviewModal from './ArticlePreviewModal';

interface ArticleGridProps {
  articles: PublicArticle[];
  onArticleUpdate: () => void;
}

export default function ArticleGrid({ articles, onArticleUpdate }: ArticleGridProps) {
  const [selectedArticle, setSelectedArticle] = useState<PublicArticle | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<PublicArticle | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const handlePurchaseClick = (article: PublicArticle) => {
    setSelectedArticle(article);
    setShowPurchaseModal(true);
  };

  const handlePreviewClick = (article: PublicArticle) => {
    setPreviewArticle(article);
    setShowPreviewModal(true);
  };

  const handlePurchaseComplete = () => {
    setShowPurchaseModal(false);
    setSelectedArticle(null);
    onArticleUpdate(); // Refresh articles to update availability
  };

  const handleModalClose = () => {
    setShowPurchaseModal(false);
    setSelectedArticle(null);
  };

  const handlePreviewClose = () => {
    setShowPreviewModal(false);
    setPreviewArticle(null);
  };

  // Listen for custom event from preview modal to open purchase modal
  useEffect(() => {
    const handleOpenPurchaseModal = (event: CustomEvent) => {
      const article = event.detail as PublicArticle;
      handlePreviewClose();
      setTimeout(() => handlePurchaseClick(article), 100);
    };

    window.addEventListener('openPurchaseModal', handleOpenPurchaseModal as EventListener);
    return () => {
      window.removeEventListener('openPurchaseModal', handleOpenPurchaseModal as EventListener);
    };
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onPurchaseClick={handlePurchaseClick}
            onPreviewClick={handlePreviewClick}
          />
        ))}
      </div>

      {/* Purchase Modal */}
      {showPurchaseModal && selectedArticle && (
        <PurchaseModal
          article={selectedArticle}
          onClose={handleModalClose}
          onComplete={handlePurchaseComplete}
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewArticle && (
        <ArticlePreviewModal
          article={previewArticle}
          onClose={handlePreviewClose}
        />
      )}
    </>
  );
}