import React, { useState } from 'react';
import Sidebar from './Sidebar';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
            <Sidebar
                open={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onChevronClick={() => setSidebarCollapsed((v) => !v)}
            />
            <div className="flex-1 flex flex-col">
                <header className="h-16 flex items-center px-4 bg-white dark:bg-gray-800 shadow">
                    <button
                        className="mr-4 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => setSidebarOpen((v) => !v)}
                        aria-label="Toggle sidebar"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span className="font-bold text-lg text-gray-800 dark:text-gray-100">Admin Dashboard</span>
                </header>
                <main className="flex-1 overflow-auto p-6">{children}</main>
            </div>
        </div>
    );
};

export default Layout; 