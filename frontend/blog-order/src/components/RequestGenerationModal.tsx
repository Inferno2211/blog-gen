import { useState } from "react";
import { useGenerationCart } from "../contexts/GenerationCartContext";
import type { GenerationRequest } from "../contexts/GenerationCartContext";

interface RequestGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  domainId: string;
  domainName: string;
  domainSlug: string;
}

export default function RequestGenerationModal({
  isOpen,
  onClose,
  domainId,
  domainName,
  domainSlug,
}: RequestGenerationModalProps) {
  const { addToCart } = useGenerationCart();

  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [keyword, setKeyword] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!topic.trim()) {
      alert("Please enter an article topic");
      return;
    }

    if (!targetUrl.trim()) {
      alert("Please enter your backlink target URL");
      return;
    }

    if (!anchorText.trim()) {
      alert("Please enter your backlink anchor text");
      return;
    }

    // Validate URL format
    try {
      new URL(targetUrl);
    } catch {
      alert("Please enter a valid URL (must include https:// or http://)");
      return;
    }

    const request: GenerationRequest = {
      domainId,
      domainName,
      domainSlug,
      topic: topic.trim(),
      niche: niche.trim() || undefined,
      keyword: keyword.trim() || undefined,
      targetUrl: targetUrl.trim(),
      anchorText: anchorText.trim(),
      notes: notes.trim() || undefined,
    };

    const success = addToCart(request);
    if (success) {
      // Reset form
      setTopic("");
      setNiche("");
      setKeyword("");
      setTargetUrl("");
      setAnchorText("");
      setNotes("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-xl">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  🎨 Request Article Generation
                </h2>
                <p className="text-green-100 text-sm">
                  Domain: <span className="font-semibold">{domainName}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
                aria-label="Close modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Topic */}
            <div>
              <label
                htmlFor="topic"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Article Topic <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., The Future of AI in Content Marketing"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                maxLength={200}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {topic.length}/200 characters
              </p>
            </div>

            {/* Niche */}
            <div>
              <label
                htmlFor="niche"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Niche (Optional)
              </label>
              <input
                type="text"
                id="niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g., Digital Marketing, SEO, Technology"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Keyword */}
            <div>
              <label
                htmlFor="keyword"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Primary Keyword (Optional)
              </label>
              <input
                type="text"
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g., AI content tools"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            {/* Backlink Section */}
            <div className="border-t border-gray-200 pt-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-green-600"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
                Your Backlink
              </h3>

              {/* Target URL */}
              <div className="mb-4">
                <label
                  htmlFor="targetUrl"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Target URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  id="targetUrl"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://your-website.com/page"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  The URL you want to link to from the generated article
                </p>
              </div>

              {/* Anchor Text */}
              <div>
                <label
                  htmlFor="anchorText"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Anchor Text <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="anchorText"
                  value={anchorText}
                  onChange={(e) => setAnchorText(e.target.value)}
                  placeholder="e.g., best AI content tools"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  The clickable text that will link to your URL
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                Additional Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or preferences for the article..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Pricing Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800">
                    Article Generation
                  </p>
                  <p className="text-xs text-green-600">
                    AI-generated, SEO-optimized content
                  </p>
                </div>
                <p className="text-2xl font-bold text-green-600">$25.00</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-md"
              >
                Add to Cart
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
