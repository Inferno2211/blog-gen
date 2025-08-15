import React from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  {
    to: "/blogs/gen",
    label: "Gen Blogs",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: "/blogs/edit",
    label: "Edit Blogs",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11 5h2m-1 0v14m-7-7h14"
        />
      </svg>
    ),
  },
  {
    to: "/blogs",
    label: "View Blogs",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    to: "/domains/create",
    label: "Create Domain",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4m0 4h.01"
        />
      </svg>
    ),
  },
  {
    to: "/domains",
    label: "View Domains",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 10h20" />
      </svg>
    ),
  },
];

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onChevronClick: () => void;
}

const Sidebar = ({
  open,
  collapsed,
  onClose,
  onChevronClick,
}: SidebarProps) => {
  return (
    <aside
      className={`transition-all duration-200 bg-white dark:bg-gray-800 shadow h-full ${
        collapsed ? "w-16" : "w-64"
      } fixed z-30 left-0 top-0 transform ${
        open ? "translate-x-0" : "-translate-x-full"
      } md:relative md:translate-x-0`}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          {!collapsed && (
            <span className="font-bold text-lg text-gray-800 dark:text-gray-100">
              Menu
            </span>
          )}
          <button
            className="md:hidden p-2"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/blogs" || item.to === "/domains"}
              className={({ isActive }) =>
                `flex items-center px-4 py-2 rounded transition-colors ${
                  isActive
                    ? "bg-blue-500 text-white"
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
                } ${collapsed ? "justify-center" : ""}`
              }
            >
              {item.icon}
              {!collapsed && <span className="ml-3">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700 flex justify-center">
          <button
            onClick={onChevronClick}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Toggle sidebar width"
          >
            {collapsed ? (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="white"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="white"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
