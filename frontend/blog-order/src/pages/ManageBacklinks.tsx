import React, { useState, useEffect } from 'react';
import { getAllArticles } from '../services/articlesService';
import { integrateBacklink } from '../services/backlinkService';
import type { Article } from '../types/article';
import type { BacklinkIntegrationRequest } from '../types/backlink';

const ManageBacklinks: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrating, setIntegrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<BacklinkIntegrationRequest>({
    articleId: '',
    backlinkUrl: '',
    anchorText: '',
    model: 'gemini-2.5-flash',
    provider: 'gemini'
  });

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const data = await getAllArticles();
      setArticles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await integrateBacklink(formData);
      setSuccess(`Backlink integrated successfully! Created version ${result.versionNum} for the article.`);

      // Reset form
      setFormData({
        articleId: '',
        backlinkUrl: '',
        anchorText: '',
        model: 'gemini-2.5-flash',
        provider: 'gemini'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to integrate backlink');
    } finally {
      setIntegrating(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const selectedArticle = articles.find(article => article.id === formData.articleId);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Integrate Backlinks</h1>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              How it works
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p>Select an article and provide a backlink URL with anchor text. Our AI will naturally integrate the backlink into the article content and create a new version.</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded dark:bg-red-900/20 dark:border-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded dark:bg-green-900/20 dark:border-green-800 dark:text-green-200">
          {success}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Integrate Backlink into Article
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Article
            </label>
            <select
              name="articleId"
              value={formData.articleId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Choose an article...</option>
              {articles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.topic || article.slug} - {article.domain ? `${article.domain.name} (${article.domain.slug})` : 'No domain assigned'}
                </option>
              ))}
            </select>
          </div>

          {selectedArticle && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Selected Article</h3>
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                <p><strong>Topic:</strong> {selectedArticle.topic || 'No topic set'}</p>
                <p><strong>Slug:</strong> <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">{selectedArticle.slug}</code></p>
                <p><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${selectedArticle.status === 'PUBLISHED'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                  {selectedArticle.status}
                </span></p>
                {selectedArticle.domain ? (
                  <>
                    <p><strong>Domain:</strong> {selectedArticle.domain.name}</p>
                    <p><strong>Slug:</strong> <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs">{selectedArticle.domain.slug}</code></p>
                    {selectedArticle.domain.url && (
                      <p><strong>URL:</strong> <a href={selectedArticle.domain.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">{selectedArticle.domain.url}</a></p>
                    )}
                  </>
                ) : (
                  <p><strong>Domain:</strong> <span className="text-orange-600 dark:text-orange-400">No domain assigned</span></p>
                )}
                {selectedArticle.keyword && (
                  <p><strong>Keyword:</strong> {selectedArticle.keyword}</p>
                )}
                {selectedArticle.niche && (
                  <p><strong>Niche:</strong> {selectedArticle.niche}</p>
                )}
                <p><strong>Versions:</strong> {selectedArticle.versions?.length || 0}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Backlink URL
            </label>
            <input
              type="url"
              name="backlinkUrl"
              value={formData.backlinkUrl}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="https://example.com/target-page"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The URL you want to link to in the article
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Anchor Text
            </label>
            <input
              type="text"
              name="anchorText"
              value={formData.anchorText}
              onChange={handleChange}
              required
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Click here to learn more"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The text that will be linked (max 200 characters)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                AI Provider
              </label>
              <select
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                AI Model
              </label>
              <select
                name="model"
                value={formData.model}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {formData.provider === 'gemini' && (
                  <>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-pro">Gemini Pro</option>
                  </>
                )}
                {formData.provider === 'openai' && (
                  <>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
                {formData.provider === 'anthropic' && (
                  <>
                    <option value="claude-3-opus">Claude 3 Opus</option>
                    <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={integrating || !formData.articleId || !formData.backlinkUrl || !formData.anchorText}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md flex items-center space-x-2"
            >
              {integrating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Integrating...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Integrate Backlink</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {articles.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No articles found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create some articles first to integrate backlinks.
          </p>
        </div>
      )}
    </div>
  );
};

export default ManageBacklinks;