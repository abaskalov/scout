import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { formatDate, formatDateShort } from '../lib/date';
import { isAdmin } from '../lib/auth';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

interface Project {
  id: number;
  name: string;
  slug: string;
}

interface Item {
  id: number;
  message: string;
  status: string;
  reporterName: string | null;
  assigneeName: string | null;
  createdAt: string;
}

interface UserListItem {
  id: string;
  name: string;
}

interface PaginationData {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

interface Counts {
  new: number;
  in_progress: number;
  review: number;
  done: number;
  cancelled: number;
}

const STATUSES = ['all', 'new', 'in_progress', 'review', 'done', 'cancelled'] as const;

const statusLabels: Record<string, string> = {
  all: 'Все',
  new: 'Новые',
  in_progress: 'В работе',
  review: 'На ревью',
  done: 'Готово',
  cancelled: 'Отменено',
};

export default function Items() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 1,
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [counts, setCounts] = useState<Counts>({
    new: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);

  // Search state
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Assignee filter state
  const [teamUsers, setTeamUsers] = useState<UserListItem[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');

  // Load projects
  useEffect(() => {
    api<{ items: Project[] }>('/api/projects/list', { perPage: 100 }).then(
      (res) => {
        setProjects(res.items);
        if (res.items.length > 0 && !selectedProject) {
          setSelectedProject(res.items[0]!.id);
        }
      },
    ).catch(() => {});
  }, []);

  // Load users for assignee filter (admin only)
  useEffect(() => {
    if (!admin) return;
    api<{ items: UserListItem[] }>('/api/users/list', { perPage: 100 })
      .then((res) => setTeamUsers(res.items))
      .catch(() => {});
  }, []);

  // Load items + counts when project or filter changes
  useEffect(() => {
    if (!selectedProject) return;

    setLoading(true);
    const body: Record<string, unknown> = {
      projectId: selectedProject,
      page: pagination.page,
      perPage: 20,
    };
    if (statusFilter !== 'all') {
      body.status = statusFilter;
    }
    if (search) {
      body.search = search;
    }
    if (assigneeFilter) {
      body.assigneeId = assigneeFilter;
    }

    Promise.all([
      api<{ items: Item[]; pagination: PaginationData }>('/api/items/list', body),
      api<{ counts: Counts }>('/api/items/count', {
        projectId: selectedProject,
      }),
    ])
      .then(([listRes, countRes]) => {
        setItems(listRes.items);
        setPagination(listRes.pagination);
        setCounts(countRes.counts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedProject, statusFilter, pagination.page, search, assigneeFilter]);

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedProject(Number(e.target.value));
    setPagination((p) => ({ ...p, page: 1 }));
    setStatusFilter('all');
    setSearch('');
    setSearchInput('');
    setAssigneeFilter('');
  }

  function handleStatusChange(status: string) {
    setStatusFilter(status);
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function handleSearchInput(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPagination((p) => ({ ...p, page: 1 }));
    }, 300);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
    setPagination((p) => ({ ...p, page: 1 }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }

  function handleAssigneeFilter(e: React.ChangeEvent<HTMLSelectElement>) {
    setAssigneeFilter(e.target.value);
    setPagination((p) => ({ ...p, page: 1 }));
  }

  const totalAll =
    counts.new + counts.in_progress + counts.review + counts.done + counts.cancelled;

  function getTabCount(status: string): number | null {
    if (status === 'all') return totalAll || null;
    const val = counts[status as keyof Counts];
    return val > 0 ? val : null;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold text-gray-900">Задачи</h1>
        <select
          value={selectedProject ?? ''}
          onChange={handleProjectChange}
          className="w-full md:w-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Search + assignee filter */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Поиск по описанию..."
            className="block w-full rounded-md border border-gray-300 pl-3 pr-8 py-1.5 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              type="button"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {admin && teamUsers.length > 0 && (
          <select
            value={assigneeFilter}
            onChange={handleAssigneeFilter}
            className="w-full md:w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="">Все исполнители</option>
            {teamUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Status filter tabs — horizontal scroll on mobile */}
      <div className="mb-4 flex gap-1 border-b border-gray-200 overflow-x-auto">
        {STATUSES.map((s) => {
          const count = getTabCount(s);
          return (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              className={`relative shrink-0 px-3 py-2 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {statusLabels[s]}
              {count !== null && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Сообщение</th>
              <th className="px-4 py-3 w-28">Статус</th>
              <th className="px-4 py-3 w-36">Автор</th>
              <th className="px-4 py-3 w-36">Исполнитель</th>
              <th className="px-4 py-3 w-40">Создано</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Загрузка...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {search ? 'Ничего не найдено' : 'Нет данных'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => navigate(`/items/${item.id}`)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 max-w-md truncate text-gray-800">
                    {item.message}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.reporterName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {item.assigneeName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(item.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="py-8 text-center text-gray-400">Загрузка...</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            {search ? 'Ничего не найдено' : 'Нет данных'}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/items/${item.id}`)}
              className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 active:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 line-clamp-2">
                  {item.message}
                </p>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                <span>{item.reporterName ?? '—'}</span>
                <span>{formatDateShort(item.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
      />
    </div>
  );
}
