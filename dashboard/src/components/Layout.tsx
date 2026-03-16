import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { getUser, isAdmin, logout } from '../lib/auth';
import { api } from '../lib/api';

export default function Layout() {
  const user = getUser();
  const admin = isAdmin();
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    // Fetch new item counts across all projects
    async function loadCounts() {
      try {
        const projects = await api<{
          items: { id: number }[];
        }>('/api/projects/list', { perPage: 100 });

        let total = 0;
        for (const project of projects.items) {
          try {
            const result = await api<{
              counts: Record<string, number>;
            }>('/api/items/count', { projectId: project.id });
            total += result.counts.new ?? 0;
          } catch {
            // skip projects we can't access
          }
        }
        setNewCount(total);
      } catch {
        // ignore
      }
    }
    loadCounts();
    const interval = setInterval(loadCounts, 30_000);
    return () => clearInterval(interval);
  }, []);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-gray-200 text-gray-900'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-gray-200 bg-gray-100">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
          <svg
            className="h-6 w-6 text-gray-800"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
          <span className="text-lg font-bold text-gray-900">Scout</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavLink to="/items" className={linkClass}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Задачи
            {newCount > 0 && (
              <span className="ml-auto rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-semibold text-yellow-900">
                {newCount}
              </span>
            )}
          </NavLink>
          {admin && (
            <>
              <NavLink to="/projects" className={linkClass}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
                </svg>
                Проекты
              </NavLink>
              <NavLink to="/users" className={linkClass}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Пользователи
              </NavLink>
            </>
          )}
        </nav>

        <div className="border-t border-gray-200 px-4 py-3">
          <div className="text-sm font-medium text-gray-800 truncate">
            {user?.name ?? user?.email ?? 'User'}
          </div>
          <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="mt-2 text-xs text-red-600 hover:text-red-800"
          >
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
