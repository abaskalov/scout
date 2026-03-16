import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import Pagination from '../components/Pagination';

interface UserItem {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'agent';
  isActive: boolean;
  projectIds?: number[];
  createdAt: string;
}

interface Project {
  id: number;
  name: string;
}

interface PaginationData {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

const emptyForm = {
  email: '',
  password: '',
  name: '',
  role: 'member' as 'admin' | 'member' | 'agent',
  isActive: true,
  projectIds: [] as number[],
};

export default function Users() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api<{ items: UserItem[]; pagination: PaginationData }>(
        '/api/users/list',
        { page: pagination.page, perPage: 20 },
      );
      setUsers(res.items);
      setPagination(res.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const res = await api<{ items: Project[] }>('/api/projects/list', {
        perPage: 100,
      });
      setProjects(res.items);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, [pagination.page]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(u: UserItem) {
    setEditingId(u.id);
    setForm({
      email: u.email,
      password: '',
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      projectIds: u.projectIds ?? [],
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          id: editingId,
          name: form.name,
          role: form.role,
          isActive: form.isActive,
          projectIds: form.projectIds,
        };
        if (form.password) {
          body.password = form.password;
        }
        await api('/api/users/update', body);
      } else {
        await api('/api/users/create', {
          email: form.email,
          password: form.password,
          name: form.name,
          role: form.role,
          projectIds: form.projectIds,
        });
      }
      setShowModal(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Удалить этого пользователя?')) return;
    try {
      await api('/api/users/delete', { id });
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  }

  function toggleProject(pid: number) {
    setForm((f) => ({
      ...f,
      projectIds: f.projectIds.includes(pid)
        ? f.projectIds.filter((x) => x !== pid)
        : [...f.projectIds, pid],
    }));
  }

  const roleBadge: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    member: 'bg-blue-100 text-blue-700',
    agent: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Пользователи</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Создать пользователя
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Имя</th>
              <th className="px-4 py-3">Эл. почта</th>
              <th className="px-4 py-3 w-24">Роль</th>
              <th className="px-4 py-3 w-20 text-center">Активен</th>
              <th className="px-4 py-3 w-28 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Загрузка...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Нет данных
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        roleBadge[u.role] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {u.role === 'admin' ? 'Админ' : u.role === 'member' ? 'Участник' : u.role === 'agent' ? 'Агент' : u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.isActive ? (
                      <span className="text-green-600">Да</span>
                    ) : (
                      <span className="text-gray-400">Нет</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="ml-3 text-sm text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editingId ? 'Редактирование пользователя' : 'Создание пользователя'}
            </h3>

            {error && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Имя</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-gray-700">Эл. почта</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={!!editingId}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-gray-700">
                Пароль{editingId ? ' (оставьте пустым, чтобы не менять)' : ''}
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingId}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-sm font-medium text-gray-700">Роль</span>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({
                    ...form,
                    role: e.target.value as 'admin' | 'member' | 'agent',
                  })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="admin">Админ</option>
                <option value="member">Участник</option>
                <option value="agent">Агент</option>
              </select>
            </label>

            {editingId && (
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="rounded border-gray-300"
                />
                Активен
              </label>
            )}

            {projects.length > 0 && (
              <div className="mt-4">
                <span className="text-sm font-medium text-gray-700">
                  Проекты
                </span>
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                  {projects.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.projectIds.includes(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="rounded border-gray-300"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
