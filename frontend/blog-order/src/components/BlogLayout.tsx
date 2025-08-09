import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Frontmatter } from '../utils/markdownParser';

interface BlogLayoutProps {
    frontmatter: Frontmatter;
    content: string;
}

const BlogLayout: React.FC<BlogLayoutProps> = ({ frontmatter, content }) => {
    return (
        <div className="flex flex-col max-w-3xl min-h-screen px-8 mx-auto bg-white rounded-xl shadow">
            {/* Main Content */}
            <main className="flex-grow">
                <section>
                    <div className="py-12 md:py-20">
                        <div className="lg:text-center">
                            <div className="max-w-xl mx-auto">
                                <h1 className="text-4xl md:text-5xl font-bold font-display text-gray-900 mb-2">
                                    {frontmatter.title}
                                </h1>
                                <p className="max-w-2xl mx-auto mt-2 text-gray-700 text-base">
                                    <em>{frontmatter.description}</em>
                                </p>
                                <p className="text-xs text-gray-500 mt-4">
                                    {frontmatter.pubDate} &mdash; Written by: {frontmatter.author}
                                </p>
                            </div>

                            {frontmatter.image?.url && (
                                <div className="my-6 flex justify-center">
                                    <img
                                        src={frontmatter.image.url}
                                        alt={frontmatter.image.alt}
                                        className="object-cover object-center w-full max-h-72 aspect-video rounded-xl shadow"
                                    />
                                </div>
                            )}

                            <div className="flex flex-col justify-between mt-4 md:items-center gap-2">
                                
                                <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                                    {frontmatter.tags.map((tag) => (
                                        <span key={tag} className="bg-blue-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="prose prose-blue max-w-2xl mt-12 mx-auto">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: ({node, ...props}) => <h1 className="text-3xl md:text-4xl font-bold mt-8 mb-4" {...props} />,
                                    h2: ({node, ...props}) => <h2 className="text-2xl md:text-3xl font-semibold mt-8 mb-3" {...props} />,
                                    h3: ({node, ...props}) => <h3 className="text-xl md:text-2xl font-semibold mt-6 mb-2" {...props} />,
                                    table: ({node, ...props}) => <table className="min-w-full border mt-6 mb-6" {...props} />,
                                    th: ({node, ...props}) => <th className="border px-3 py-2 text-gray-700 bg-gray-100 text-left" {...props} />,
                                    td: ({node, ...props}) => <td className="border px-3 py-2 text-gray-700" {...props} />,
                                }}
                            >
                                {content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default BlogLayout; 