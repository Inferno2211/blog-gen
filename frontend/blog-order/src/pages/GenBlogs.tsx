import React, { useState, useEffect } from 'react';
import type { GenerateBlogRequest, BlogApiResponse, BlogVersion } from '../types/blog';
import { generateBlog, generateBlogVersion, setSelectedVersion as setSelectedVersionApi } from '../services/blogService';
import { getAllDomains } from '../services/domainService';
import type { Domain } from '../types/domain';
import BlogLayout from '../components/BlogLayout';
import { parseMarkdownWithFrontmatter } from '../utils/markdownParser';

const initialForm: GenerateBlogRequest = {
    domain_id: '',
    user: '',
    niche: '',
    keyword: '',
    topic: '',
    n: 1,
    targetURL: '',
    anchorText: '',
    model: 'gemini-2.5-flash',
    provider: 'gemini',
    userPrompt: '',
};

const GenBlogs = () => {
    const [form, setForm] = useState(initialForm);
    const [loading, setLoading] = useState(false);
    const [blog, setBlog] = useState<BlogApiResponse | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<BlogVersion | null>(null);
    const [drafts, setDrafts] = useState<BlogVersion[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loadingDomains, setLoadingDomains] = useState(true);
    const [useUserPrompt, setUseUserPrompt] = useState(false);

    // Load domains on component mount
    useEffect(() => {
        const loadDomains = async () => {
            try {
                setLoadingDomains(true);
                const response = await getAllDomains();
                setDomains(response.domains);
            } catch (error) {
                console.error('Failed to load domains:', error);
                setError('Failed to load domains');
            } finally {
                setLoadingDomains(false);
            }
        };
        loadDomains();
    }, []);

    // Update form when user prompt toggle changes
    useEffect(() => {
        if (useUserPrompt) {
            setForm(prev => ({
                ...prev,
                niche: '',
                keyword: '',
                topic: '',
                n: 1,
                targetURL: '',
                anchorText: '',
                userPrompt: '',
            }));
        } else {
            setForm(prev => ({
                ...prev,
                userPrompt: '',
            }));
        }
    }, [useUserPrompt]);

    // Update provider when model changes
    useEffect(() => {
        if (form.model === 'gemini-2.5-flash' || form.model === 'gemini-2.0-flash') {
            setForm(prev => ({ ...prev, provider: 'gemini' }));
        } else if (form.model === 'vllm') {
            setForm(prev => ({ ...prev, provider: 'vllm' }));
        }
    }, [form.model]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: name === 'n' ? Number(value) : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await generateBlog(form);
            setBlog(res);
            // Initialize drafts array with the initial version
            setDrafts([res.draft]);
            // Show latest version by default
            setSelectedVersion(res.draft);
        } catch (err) {
            setError('Failed to generate blog.');
        } finally {
            setLoading(false);
        }
    };

    const handleNewVersion = async () => {
        if (!blog) return;
        setLoading(true);
        setError('');
        try {
            const res = await generateBlogVersion({ 
                articleId: blog.articleId,
                provider: form.provider 
            });
            // Add the new version to drafts array
            setDrafts(prev => [...prev, res.draft]);
            setSelectedVersion(res.draft);
        } catch (err) {
            setError('Failed to generate new version.');
        } finally {
            setLoading(false);
        }
    };

    const handleNewBlog = () => {
        setShowConfirm(true);
    };

    const handleSelectVersion = async (version: BlogVersion) => {
        if (!blog) return;
        setLoading(true);
        setError('');
        try {
            await setSelectedVersionApi(blog.articleId, version.versionId);
            setSelectedVersion(version);
            setError('');
        } catch (err) {
            setError('Failed to select version.');
        } finally {
            setLoading(false);
        }
    };

    const confirmNewBlog = () => {
        setBlog(null);
        setSelectedVersion(null);
        setDrafts([]);
        setForm(initialForm);
        setUseUserPrompt(false);
        setShowConfirm(false);
    };

    // Parse markdown for preview
    let parsed = null;
    if (selectedVersion) {
        parsed = parseMarkdownWithFrontmatter(selectedVersion.content);
    }

    return (
        <div className="max-w-4xl mx-auto py-10">
            <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-gray-100">Buy a Blog - Private Blog Network</h1>
            
            {/* User Prompt Toggle */}
            <div className="mb-6 flex items-center justify-center">
                <label className="flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={useUserPrompt}
                        onChange={(e) => setUseUserPrompt(e.target.checked)}
                        className="sr-only"
                    />
                    <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useUserPrompt ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useUserPrompt ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        Use Custom Prompt
                    </span>
                </label>
            </div>

            {/* Blog Generation Form */}
            <form
                className={`grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/5 p-8 rounded-xl shadow transition-all duration-300 ${blog ? 'opacity-60 pointer-events-none h-0 overflow-hidden p-0 m-0' : ''}`}
                onSubmit={handleSubmit}
                style={{ display: blog ? 'none' : undefined }}
            >
                {/* Domain and Model fields - always visible */}
                <div>
                    <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Domain *</label>
                    <select
                        name="domain_id"
                        value={form.domain_id}
                        onChange={handleChange}
                        className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        required
                        disabled={loadingDomains}
                    >
                        <option value="">Select a domain</option>
                        {domains.map((domain) => (
                            <option key={domain.id} value={domain.id}>
                                {domain.name} ({domain.slug})
                            </option>
                        ))}
                    </select>
                    {loadingDomains && (
                        <div className="text-sm text-gray-500 mt-1">Loading domains...</div>
                    )}
                </div>

                <div>
                    <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">AI Model *</label>
                    <select
                        name="model"
                        value={form.model}
                        onChange={handleChange}
                        className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        required
                    >
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="vllm">vLLM</option>
                    </select>
                </div>

                {useUserPrompt ? (
                    // User Prompt Mode - Only domain, model, and prompt fields
                    <div className="md:col-span-2">
                        <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Custom Prompt *</label>
                        <textarea
                            name="userPrompt"
                            value={form.userPrompt}
                            onChange={handleChange}
                            className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                            placeholder="Enter your custom prompt here..."
                            rows={6}
                            required
                        />
                    </div>
                ) : (
                    // Standard Mode - All fields
                    <>
                        <div>
                            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Niche *</label>
                            <input
                                type="text"
                                name="niche"
                                value={form.niche}
                                onChange={handleChange}
                                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="e.g., Technology, Health, Gaming"
                                required
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Keyword *</label>
                            <input
                                type="text"
                                name="keyword"
                                value={form.keyword}
                                onChange={handleChange}
                                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="e.g., productivity tools"
                                required
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Topic *</label>
                            <input
                                type="text"
                                name="topic"
                                value={form.topic}
                                onChange={handleChange}
                                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="e.g., Top 10 Productivity Tools for 2025"
                                required
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Number of Sections *</label>
                            <input
                                type="number"
                                name="n"
                                value={form.n}
                                min={1}
                                max={10}
                                onChange={handleChange}
                                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                                required
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Target URL</label>
                            <input
                                type="text"
                                name="targetURL"
                                value={form.targetURL}
                                onChange={handleChange}
                                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="https://example.com"
                            />
                        </div>
                        <div>
                            <label className="block font-medium mb-1 text-gray-800 dark:text-gray-200">Anchor Text</label>
                            <input
                                type="text"
                                name="anchorText"
                                value={form.anchorText}
                                onChange={handleChange}
                                className="w-full p-2 rounded border border-gray-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                                placeholder="Click here to learn more"
                            />
                        </div>
                    </>
                )}

                <div className="md:col-span-2 flex justify-center mt-4">
                    <button
                        type="submit"
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg disabled:opacity-60 shadow-md hover:bg-blue-700 transition"
                        disabled={loading || blog !== null || loadingDomains}
                    >
                        {loading ? 'Generating...' : 'Create Blog'}
                    </button>
                </div>
            </form>
            {/* Options after blog is created */}
            {blog && (
                <div className="flex flex-col md:flex-row gap-4 justify-center mt-8">
                    <button
                        className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition disabled:opacity-60"
                        onClick={handleNewVersion}
                        disabled={loading}
                    >
                        {loading ? 'Generating...' : 'New Version'}
                    </button>
                    <button
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg shadow hover:bg-gray-700 transition"
                        onClick={handleNewBlog}
                    >
                        New Blog
                    </button>
                    <button
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow hover:bg-purple-700 transition disabled:opacity-60"
                        onClick={() => selectedVersion && handleSelectVersion(selectedVersion)}
                        disabled={loading || !selectedVersion}
                    >
                        {loading ? 'Selecting...' : 'Select Version'}
                    </button>
                </div>
            )}
            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl max-w-sm w-full">
                        <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Start a new blog?</h2>
                        <p className="mb-6 text-gray-700 dark:text-gray-300">This will clear all drafts and versions. Are you sure?</p>
                        <div className="flex gap-4 justify-end">
                            <button className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100" onClick={() => setShowConfirm(false)}>Cancel</button>
                            <button className="px-4 py-2 rounded-lg bg-red-600 text-white" onClick={confirmNewBlog}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Error Message */}
            {error && <div className="text-red-600 text-center mt-4">{error}</div>}
            {/* Blog Versions as Cards */}
            {drafts.length > 0 && (
                <div className="mt-10">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Blog Versions</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {drafts.map((v, idx) => (
                            <div
                                key={v.versionId || idx}
                                className={`rounded-xl shadow p-4 cursor-pointer border-2 transition-all ${selectedVersion?.versionId === v.versionId ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-transparent bg-white dark:bg-gray-800'}`}
                                onClick={() => setSelectedVersion(v)}
                            >
                                <div className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">{parseMarkdownWithFrontmatter(v.content).frontmatter.title || `Version ${v.versionNum ?? idx + 1}`}</div>
                                <div className="text-sm text-gray-500">Version {v.versionNum ?? idx + 1}</div>
                                {v.qcResult && (
                                    <div className="text-xs mt-2">
                                        <span className={`px-2 py-1 rounded ${
                                            v.qcResult.status === 'pass' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                        }`}>
                                            QC: {v.qcResult.status}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* Preview Section */}
            {parsed && (
                <div className="mt-12">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Preview</h2>
                    <BlogLayout frontmatter={parsed.frontmatter} content={parsed.content} />
                </div>
            )}
        </div>
    );
};

export default GenBlogs; 