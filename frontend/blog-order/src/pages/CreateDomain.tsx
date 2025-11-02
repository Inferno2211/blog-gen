import React, { useState, useEffect } from 'react';
import { createDomain, bulkCreateDomains, getAvailableTemplates, createDomainFolder } from '../services/domainService';
import type { CreateDomainRequest, BulkCreateDomainRequest, BulkCreateDomainResponse, CreateDomainResponse } from '../types/domain';

const CreateDomain = () => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  // Single add state
  const [single, setSingle] = useState<CreateDomainRequest>({ 
    name: '', 
    slug: '', 
    url: '', 
    tags: '', 
    categories: '',
    domain_age: undefined,
    domain_rating: undefined,
    template: 'default' 
  });
  const [singleResult, setSingleResult] = useState<CreateDomainResponse | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  // Bulk add state
  const [bulkDomains, setBulkDomains] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkTemplate, setBulkTemplate] = useState('default');
  const [bulkResult, setBulkResult] = useState<BulkCreateDomainResponse | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<{ label: string; value: string }[]>([
    { label: 'Default', value: 'default' }
  ]);

  // Load available templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const templatesRes = await getAvailableTemplates();
        const options = templatesRes.templates.map(template => ({
          label: template,
          value: template
        }));
        setTemplateOptions(options);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };
    loadTemplates();
  }, []);

  // Auto-generate slug from name
  const handleSingleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setSingle((prev) => ({ ...prev, name, slug: name.toLowerCase().replace(/\s+/g, '-') }));
  };

  const handleSingleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSingle((prev) => ({ ...prev, [name]: value }));
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleLoading(true);
    setSingleResult(null);
    try {
      // Create domain in database
      const res = await createDomain(single);
      
      // If successful, also create domain folder
      if (res.success && single.slug) {
        try {
          await createDomainFolder(single.slug);
        } catch (folderError) {
          console.warn('Domain created but folder creation failed:', folderError);
        }
      }
      
      setSingleResult(res);
      if (res.success) setSingle({ 
        name: '', 
        slug: '', 
        url: '', 
        tags: '', 
        categories: '',
        domain_age: undefined,
        domain_rating: undefined,
        template: 'default' 
      });
    } catch (err) {
      console.error('Failed to create domain:', err);
      setSingleResult({ success: false, error: err instanceof Error ? err.message : 'Failed to create domain.' });
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkLoading(true);
    setBulkResult(null);
    const domains = bulkDomains
      .split('\n')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
    if (domains.length === 0) {
      setBulkResult({ results: [] });
      setBulkLoading(false);
      return;
    }
    const req: BulkCreateDomainRequest = {
      domains,
      tags: bulkTags,
      template: bulkTemplate,
    };
    try {
      const res = await bulkCreateDomains(req);
      
      // Create domain folders for successful creations
      const folderPromises = res.results
        .filter(result => result.success)
        .map(async (result) => {
          try {
            await createDomainFolder(result.domain);
          } catch (folderError) {
            console.warn(`Domain ${result.domain} created but folder creation failed:`, folderError);
          }
        });
      
      await Promise.all(folderPromises);
      
      setBulkResult(res);
      setBulkDomains('');
      setBulkTags('');
      setBulkTemplate('default');
    } catch (err) {
      setBulkResult({ results: domains.map((d) => ({ domain: d, success: false, error: 'Failed to create domain.' })) });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-gray-100">Create Domain</h1>
      <div className="flex justify-center mb-6">
        <button
          className={`px-4 py-2 rounded-l-lg ${mode === 'single' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
          onClick={() => setMode('single')}
        >
          Single Add
        </button>
        <button
          className={`px-4 py-2 rounded-r-lg ${mode === 'bulk' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
          onClick={() => setMode('bulk')}
        >
          Bulk Add
        </button>
      </div>
      {mode === 'single' ? (
        <form className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow space-y-6" onSubmit={handleSingleSubmit}>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Name *</label>
            <input
              type="text"
              name="name"
              value={single.name}
              onChange={handleSingleNameChange}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Slug *</label>
            <input
              type="text"
              name="slug"
              value={single.slug}
              onChange={handleSingleChange}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">URL</label>
            <input
              type="text"
              name="url"
              value={single.url}
              onChange={handleSingleChange}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Tags (comma separated)</label>
            <input
              type="text"
              name="tags"
              value={single.tags}
              onChange={handleSingleChange}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Categories (comma separated)</label>
            <input
              type="text"
              name="categories"
              value={single.categories || ''}
              onChange={handleSingleChange}
              placeholder="e.g., technology, business, finance"
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Domain Age (years)</label>
              <input
                type="number"
                name="domain_age"
                value={single.domain_age || ''}
                onChange={handleSingleChange}
                placeholder="e.g., 5"
                min="0"
                max="50"
                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Domain Rating (0-100)</label>
              <input
                type="number"
                name="domain_rating"
                value={single.domain_rating || ''}
                onChange={handleSingleChange}
                placeholder="e.g., 75"
                min="0"
                max="100"
                step="0.1"
                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Template</label>
            <select
              name="template"
              value={single.template}
              onChange={handleSingleChange}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {templateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-center">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:opacity-60 shadow-md hover:bg-blue-700 transition"
              disabled={singleLoading}
            >
              {singleLoading ? 'Creating...' : 'Create Domain'}
            </button>
          </div>
          {singleResult && (
            <div className={`mt-4 text-center ${singleResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {singleResult.success ? `Domain created! Slug: ${singleResult.slug}` : singleResult.error}
            </div>
          )}
        </form>
      ) : (
        <form className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow space-y-6" onSubmit={handleBulkSubmit}>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Bulk Add* (one domain per line)</label>
            <textarea
              rows={6}
              value={bulkDomains}
              onChange={(e) => setBulkDomains(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="domain1.com\ndomain2.com\ndomain3.com"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Tags (comma separated)</label>
            <input
              type="text"
              value={bulkTags}
              onChange={(e) => setBulkTags(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Template</label>
            <select
              value={bulkTemplate}
              onChange={(e) => setBulkTemplate(e.target.value)}
              className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {templateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-center">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:opacity-60 shadow-md hover:bg-blue-700 transition"
              disabled={bulkLoading}
            >
              {bulkLoading ? 'Creating...' : 'Bulk Add'}
            </button>
          </div>
          {bulkResult && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-2 text-gray-100">Bulk Add Results</h2>
              <table className="min-w-full border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="text-gray-100 border px-3 py-2 text-left">Domain</th>
                    <th className="text-gray-100 border px-3 py-2 text-left">Status</th>
                    <th className="text-gray-100 border px-3 py-2 text-left">ID</th>
                    <th className="text-gray-100 border px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResult.results.map((r, i) => (
                    <tr key={i} className={r.success ? 'bg-green-400/20' : 'bg-red-900/20'}>
                      <td className="text-gray-100 border px-3 py-2">{r.domain}</td>
                      <td className="text-gray-100 border px-3 py-2">{r.success ? 'Success' : 'Failed'}</td>
                      <td className="text-gray-100 border px-3 py-2">{r.id || '-'}</td>
                      <td className="border px-3 py-2 text-red-600">{r.error || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default CreateDomain; 