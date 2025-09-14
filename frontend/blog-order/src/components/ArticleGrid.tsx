import { useState } from 'react';
import type { PublicArticle } from '../types/purchase';
import ArticleCard from './ArticleCard';
import PurchaseModal from './PurchaseModal';

interface ArticleGridProps {
  articles: PublicArticle[];
  onArticleUpdate: () => void;
}

export default function ArticleGrid({ articles, onArticleUpdate }: ArticleGridProps) {
  const [selectedArticle, setSelectedArticle] = useState<PublicArticle | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  const handlePurchaseClick = (article: PublicArticle) => {
    setSelectedArticle(article);
    setShowPurchaseModal(true);
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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            article={article}
            onPurchaseClick={handlePurchaseClick}
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
    </>
  );
}