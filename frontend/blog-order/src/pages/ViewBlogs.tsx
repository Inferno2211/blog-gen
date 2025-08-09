import { useState, useEffect } from 'react';
import {
    getAllArticles,
    updateArticle,
    deleteArticle,
    setSelectedVersion as setSelectedVersionService,
    publishBlog
} from '../services/articlesService';
import type { Article, ArticleVersion } from '../types/article';

interface FilterState {
    domain: string;
    status: string;
    user: string;
    topic: string;
}

interface SortState {
    field: keyof Article;
    direction: 'asc' | 'desc';
}

const ViewBlogs = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingArticle, setEditingArticle] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Article>>({});
    const [filters, setFilters] = useState<FilterState>({
        domain: '',
        status: '',
        user: '',
        topic: ''
    });
    const [sort, setSort] = useState<SortState>({
        field: 'created_at',
        direction: 'desc'
    });
    const [selectedVersion, setSelectedVersion] = useState<Record<string, string>>({});
    const [publishing, setPublishing] = useState<string | null>(null);

    // Get unique values for filter options
    const domains = [...new Set(articles.map(a => a.domain?.slug).filter(Boolean))];
    const users = [...new Set(articles.map(a => a.user).filter(Boolean))];
    const topics = [...new Set(articles.map(a => a.topic).filter(Boolean))];
    const statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING', 'GENERATED', 'FLAGGED_BY_AI', 'APPROVED_BY_AI'];

    useEffect(() => {
        loadArticles();
    }, []);

    const loadArticles = async () => {
        try {
            setLoading(true);
            const response = await getAllArticles();
            setArticles(response);

            // Initialize selected versions
            const versionMap: Record<string, string> = {};
            response.forEach((article: Article) => {
                if (article.selected_version_id) {
                    versionMap[article.id] = article.selected_version_id;
                }
            });
            setSelectedVersion(versionMap);
        } catch (error) {
            console.error('Failed to load articles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (article: Article) => {
        setEditingArticle(article.id);
        setEditForm({
            status: article.status,
            user: article.user,
            topic: article.topic,
            niche: article.niche,
            keyword: article.keyword,
            backlink_target: article.backlink_target,
            anchor: article.anchor
        });
    };

    const handleSave = async (id: string) => {
        try {
            await updateArticle(id, editForm);
            setArticles(articles.map(a => a.id === id ? { ...a, ...editForm } : a));
            setEditingArticle(null);
            setEditForm({});
        } catch (error) {
            console.error('Failed to update article:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) return;
        try {
            await deleteArticle(id);
            setArticles(articles.filter(a => a.id !== id));
        } catch (error) {
            console.error('Failed to delete article:', error);
        }
    };

    const handleVersionChange = async (articleId: string, versionId: string) => {
        try {
            if (versionId === '') {
                // Clear selected version
                setSelectedVersion(prev => ({ ...prev, [articleId]: '' }));
                setArticles(articles.map(a =>
                    a.id === articleId ? { ...a, selected_version_id: null } : a
                ));
            } else {
                // Set selected version
                await setSelectedVersionService(articleId, versionId);
                setSelectedVersion(prev => ({ ...prev, [articleId]: versionId }));
                setArticles(articles.map(a =>
                    a.id === articleId ? { ...a, selected_version_id: versionId } : a
                ));
            }
        } catch (error) {
            console.error('Failed to set selected version:', error);
        }
    };

    const handlePublish = async (articleId: string) => {
        try {
            setPublishing(articleId);
            await publishBlog(articleId);
            setArticles(articles.map(a =>
                a.id === articleId ? { ...a, status: 'PUBLISHED' } : a
            ));
            alert('Article published successfully!');
        } catch (error) {
            console.error('Failed to publish article:', error);
            alert('Failed to publish article. Please check if the article has a domain and selected version.');
        } finally {
            setPublishing(null);
        }
    };

    const handleSort = (field: keyof Article) => {
        setSort(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleFilterChange = (key: keyof FilterState, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    // Apply filters and sorting
    const filteredAndSortedArticles = articles
        .filter(article => {
            if (filters.domain && article.domain?.slug !== filters.domain) return false;
            if (filters.status && article.status !== filters.status) return false;
            if (filters.user && article.user !== filters.user) return false;
            if (filters.topic && article.topic !== filters.topic) return false;
            return true;
        })
        .sort((a, b) => {
            const aValue = a[sort.field];
            const bValue = b[sort.field];

            if (aValue === null || aValue === undefined) return 1;
            if (bValue === null || bValue === undefined) return -1;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sort.direction === 'asc'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }

            if (aValue instanceof Date && bValue instanceof Date) {
                return sort.direction === 'asc'
                    ? aValue.getTime() - bValue.getTime()
                    : bValue.getTime() - aValue.getTime();
            }

            return 0;
        });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        const colors = {
            'DRAFT': 'bg-gray-100 text-gray-800',
            'PUBLISHED': 'bg-green-100 text-green-800',
            'ARCHIVED': 'bg-red-100 text-red-800',
            'PENDING': 'bg-yellow-100 text-yellow-800',
            'GENERATED': 'bg-blue-100 text-blue-800',
            'FLAGGED_BY_AI': 'bg-orange-100 text-orange-800',
            'APPROVED_BY_AI': 'bg-purple-100 text-purple-800'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-10">
                <div className="text-center">Loading articles...</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Article Management</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage all articles, versions, and publishing</p>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain</label>
                        <select
                            value={filters.domain}
                            onChange={(e) => handleFilterChange('domain', e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">All Domains</option>
                            {domains.map(domain => (
                                <option key={domain} value={domain}>{domain}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">All Statuses</option>
                            {statuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label>
                        <select
                            value={filters.user}
                            onChange={(e) => handleFilterChange('user', e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">All Users</option>
                            {users.map(user => (
                                <option key={user} value={user || ''}>{user || ''}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic</label>
                        <select
                            value={filters.topic}
                            onChange={(e) => handleFilterChange('topic', e.target.value)}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">All Topics</option>
                            {topics.map(topic => (
                                <option key={topic} value={topic || ''}>{topic || ''}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Articles Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => handleSort('slug')}
                                >
                                    <div className="flex items-center">
                                        Article
                                        {sort.field === 'slug' && (
                                            <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => handleSort('status')}
                                >
                                    <div className="flex items-center">
                                        Status
                                        {sort.field === 'status' && (
                                            <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Domain
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Backlink Info
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={() => handleSort('created_at')}
                                >
                                    <div className="flex items-center">
                                        Created
                                        {sort.field === 'created_at' && (
                                            <span className="ml-1">{sort.direction === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Versions
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredAndSortedArticles.map((article) => (
                                <tr key={article.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {article.slug}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                {article.topic} • {article.niche}
                                            </div>
                                            {article.user && (
                                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                                    by {article.user}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(article.status)}`}>
                                            {article.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900 dark:text-gray-100">
                                            {article.domain?.name || '-'}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {article.domain?.slug || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm">
                                            {article.backlink_target ? (
                                                <div>
                                                    <div className="text-gray-900 dark:text-gray-100 truncate max-w-xs">
                                                        {article.backlink_target}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        Anchor: {article.anchor || '-'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-500">No backlink</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                        {formatDate(article.created_at)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm">
                                            <div className="text-gray-900 dark:text-gray-100">
                                                {article.versions?.length || 0} versions
                                            </div>
                                            {article.versions && article.versions.length > 0 && (
                                                <select
                                                    value={selectedVersion[article.id] || ''}
                                                    onChange={(e) => handleVersionChange(article.id, e.target.value)}
                                                    className="mt-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                                >
                                                    <option value="">None</option>
                                                    {article.versions.map((version: ArticleVersion) => (
                                                        <option key={version.id} value={version.id}>
                                                            v{version.version_num} {version.id === article.selected_version_id ? '(Selected)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            {editingArticle === article.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSave(article.id)}
                                                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingArticle(null);
                                                            setEditForm({});
                                                        }}
                                                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleEdit(article)}
                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                    >
                                                        Edit
                                                    </button>
                                                    {article.status !== 'PUBLISHED' && (
                                                        <button
                                                            onClick={() => handlePublish(article.id)}
                                                            disabled={publishing === article.id}
                                                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-50"
                                                        >
                                                            {publishing === article.id ? 'Publishing...' : 'Publish'}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(article.id)}
                                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
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

            {/* Edit Modal */}
            {editingArticle && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Article</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                                <select
                                    value={editForm.status || ''}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                >
                                    {statuses.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label>
                                <input
                                    type="text"
                                    value={editForm.user || ''}
                                    onChange={(e) => setEditForm({ ...editForm, user: e.target.value })}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topic</label>
                                <input
                                    type="text"
                                    value={editForm.topic || ''}
                                    onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Niche</label>
                                <input
                                    type="text"
                                    value={editForm.niche || ''}
                                    onChange={(e) => setEditForm({ ...editForm, niche: e.target.value })}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keyword</label>
                                <input
                                    type="text"
                                    value={editForm.keyword || ''}
                                    onChange={(e) => setEditForm({ ...editForm, keyword: e.target.value })}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backlink Target</label>
                                <input
                                    type="text"
                                    value={editForm.backlink_target || ''}
                                    onChange={(e) => setEditForm({ ...editForm, backlink_target: e.target.value })}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anchor Text</label>
                                <input
                                    type="text"
                                    value={editForm.anchor || ''}
                                    onChange={(e) => setEditForm({ ...editForm, anchor: e.target.value })}
                                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-6">
                            <button
                                onClick={() => {
                                    setEditingArticle(null);
                                    setEditForm({});
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSave(editingArticle)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {filteredAndSortedArticles.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {articles.length === 0 ? 'No articles found.' : 'No articles match the current filters.'}
                </div>
            )}
        </div>
    );
};

export default ViewBlogs; 