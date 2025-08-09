import React, { useState, useEffect } from 'react';
import { 
  getAllDomains, 
  updateDomain, 
  deleteDomain, 
  getAvailableTemplates, 
  switchDomainTemplate,
  createDomainFolder,
  buildDomain,
  getDomainStatus,
  downloadDomain
} from '../services/domainService';
import type { Domain, DomainInfo, TemplateResponse } from '../types/domain';

const ViewDomains = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainInfos, setDomainInfos] = useState<DomainInfo[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Domain>>({});
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [statuses, setStatuses] = useState<Record<string, any>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [domainsRes, templatesRes] = await Promise.all([
        getAllDomains(),
        getAvailableTemplates()
      ]);
      setDomains(domainsRes.domains);
      setTemplates(templatesRes.templates);
      
      // Load domain statuses
      const statusPromises = domainsRes.domains.map(async (domain) => {
        try {
          const status = await getDomainStatus(domain.slug);
          return { [domain.slug]: status.status };
        } catch (error) {
          return { [domain.slug]: null };
        }
      });
      const statusResults = await Promise.all(statusPromises);
      const statusMap = statusResults.reduce((acc, status) => ({ ...acc, ...status }), {} as Record<string, any>);
      setStatuses(statusMap);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (domain: Domain) => {
    setEditingDomain(domain.id);
    setEditForm({
      name: domain.name,
      slug: domain.slug,
      url: domain.url,
      tags: domain.tags
    });
  };

  const handleSave = async (id: string) => {
    try {
      await updateDomain(id, editForm);
      setDomains(domains.map(d => d.id === id ? { ...d, ...editForm } : d));
      setEditingDomain(null);
      setEditForm({});
    } catch (error) {
      console.error('Failed to update domain:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain?')) return;
    try {
      await deleteDomain(id);
      setDomains(domains.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete domain:', error);
    }
  };

  const handleSwitchTemplate = async (domainName: string, newTemplate: string) => {
    try {
      await switchDomainTemplate(domainName, newTemplate);
      alert(`Template switched to ${newTemplate} for ${domainName}`);
      loadData(); // Reload to get updated status
    } catch (error) {
      console.error('Failed to switch template:', error);
      alert('Failed to switch template');
    }
  };

  const handleCreateFolder = async () => {
    if (!newDomainName.trim()) return;
    try {
      await createDomainFolder(newDomainName);
      alert(`Domain folder created for ${newDomainName}`);
      setShowCreateFolder(false);
      setNewDomainName('');
      loadData();
    } catch (error) {
      console.error('Failed to create domain folder:', error);
      alert('Failed to create domain folder');
    }
  };

  const handleBuildDomain = async (domainName: string) => {
    try {
      const result = await buildDomain(domainName);
      alert(`Domain ${domainName} built successfully!`);
      loadData(); // Reload to get updated status
    } catch (error) {
      console.error('Failed to build domain:', error);
      alert('Failed to build domain');
    }
  };

  const handleDownloadDomain = async (domainName: string) => {
    try {
      const blob = await downloadDomain(domainName);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${domainName}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download domain:', error);
      alert('Failed to download domain');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-10">
        <div className="text-center">Loading domains...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Manage Domains</h1>
        <button
          onClick={() => setShowCreateFolder(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          Create Domain Folder
        </button>
      </div>

      {/* Create Domain Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Create Domain Folder</h3>
            <input
              type="text"
              placeholder="Domain name"
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateFolder(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Domains Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {domains.map((domain) => (
                <tr key={domain.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingDomain === domain.id ? (
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full p-1 border rounded"
                      />
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {domain.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {domain.slug}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingDomain === domain.id ? (
                      <input
                        type="text"
                        value={editForm.url || ''}
                        onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                        className="w-full p-1 border rounded"
                      />
                    ) : (
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {domain.url || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingDomain === domain.id ? (
                      <input
                        type="text"
                        value={editForm.tags || ''}
                        onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                        className="w-full p-1 border rounded"
                      />
                    ) : (
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {domain.tags || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      {statuses[domain.slug] ? (
                        <div>
                          <div className={`inline-flex px-2 py-1 text-xs rounded-full ${
                            statuses[domain.slug].exists ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {statuses[domain.slug].exists ? 'Active' : 'Inactive'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {statuses[domain.slug].postCount || 0} posts
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Unknown</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={statuses[domain.slug]?.layout || 'default'}
                      onChange={(e) => handleSwitchTemplate(domain.slug, e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      {templates.map((template) => (
                        <option key={template} value={template}>
                          {template}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {editingDomain === domain.id ? (
                        <>
                          <button
                            onClick={() => handleSave(domain.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingDomain(null);
                              setEditForm({});
                            }}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(domain)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleBuildDomain(domain.slug)}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            Build
                          </button>
                          <button
                            onClick={() => handleDownloadDomain(domain.slug)}
                            className="text-green-600 hover:text-green-900"
                            title="Download as ZIP"
                          >
                            📥
                          </button>
                          <button
                            onClick={() => handleDelete(domain.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {domains.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No domains found. Create your first domain to get started.
        </div>
      )}
    </div>
  );
};

export default ViewDomains; 