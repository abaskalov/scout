import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import Pagination from '../components/Pagination';

interface ProjectRaw {
  id: string;
  name: string;
  slug: string;
  allowedOrigins: string; // JSON string from API
  autofixEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Project extends Omit<ProjectRaw, 'allowedOrigins'> {
  allowedOrigins: string[];
}

function parseProject(p: ProjectRaw): Project {
  let origins: string[] = [];
  try {
    origins = typeof p.allowedOrigins === 'string' ? JSON.parse(p.allowedOrigins) : p.allowedOrigins;
  } catch { origins = []; }
  return { ...p, allowedOrigins: origins };
}

interface PaginationData {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

const emptyForm = {
  name: '',
  slug: '',
  allowedOrigins: '',
  autofixEnabled: false,
  isActive: true,
};

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await api<{ items: Project[]; pagination: PaginationData }>(
        '/api/projects/list',
        { page: pagination.page, perPage: 20 },
      );
      setProjects((res.items as unknown as ProjectRaw[]).map(parseProject));
      setPagination(res.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, [pagination.page]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(p: Project) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      slug: p.slug,
      allowedOrigins: p.allowedOrigins.join(', '),
      autofixEnabled: p.autofixEnabled,
      isActive: p.isActive,
    });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const origins = form.allowedOrigins
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingId) {
        await api('/api/projects/update', {
          id: editingId,
          name: form.name,
          allowedOrigins: origins,
          autofixEnabled: form.autofixEnabled,
          isActive: form.isActive,
        });
      } else {
        await api('/api/projects/create', {
          name: form.name,
          slug: form.slug,
          allowedOrigins: origins,
        });
      }
      setShowModal(false);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить этот проект?')) return;
    try {
      await api('/api/projects/delete', { id });
      await loadProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  }

  async function toggleField(
    p: Project,
    field: 'autofixEnabled' | 'isActive',
  ) {
    try {
      await api('/api/projects/update', {
        id: p.id,
        [field]: !p[field],
      });
      await loadProjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка обновления');
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 md:mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Проекты</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Создать проект
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Слаг</th>
              <th className="px-4 py-3">Источники</th>
              <th className="px-4 py-3 w-24 text-center">Авто-фикс</th>
              <th className="px-4 py-3 w-24 text-center">Активен</th>
              <th className="px-4 py-3 w-28 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Загрузка...
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Нет данных
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {p.slug}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                    {p.allowedOrigins.join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      value={p.autofixEnabled}
                      onChange={() => toggleField(p, 'autofixEnabled')}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      value={p.isActive}
                      onChange={() => toggleField(p, 'isActive')}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
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

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="py-8 text-center text-gray-400">Загрузка...</div>
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-gray-400">Нет данных</div>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-gray-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800">{p.name}</div>
                  <div className="text-xs font-mono text-gray-400 mt-0.5">{p.slug}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.isActive ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Активен</span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Неактивен</span>
                  )}
                </div>
              </div>
              {p.allowedOrigins.length > 0 && (
                <div className="mt-2 text-xs text-gray-400 truncate">
                  {p.allowedOrigins.join(', ')}
                </div>
              )}
              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Toggle
                      value={p.autofixEnabled}
                      onChange={() => toggleField(p, 'autofixEnabled')}
                    />
                    Авто-фикс
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Toggle
                      value={p.isActive}
                      onChange={() => toggleField(p, 'isActive')}
                    />
                    Активен
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </div>
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

      {/* Modal — full screen on mobile, centered on desktop */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <form
            onSubmit={handleSubmit}
            className="w-full md:max-w-md rounded-t-xl md:rounded-lg border border-gray-200 bg-white p-5 md:p-6 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editingId ? 'Редактирование проекта' : 'Создание проекта'}
            </h3>

            {error && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Название</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            {!editingId && (
              <label className="mt-3 block">
                <span className="text-sm font-medium text-gray-700">Слаг</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                  placeholder="my-project" 
                />
              </label>
            )}

            <label className="mt-3 block">
              <span className="text-sm font-medium text-gray-700">
                Разрешённые источники
              </span>
              <input
                type="text"
                value={form.allowedOrigins}
                onChange={(e) =>
                  setForm({ ...form, allowedOrigins: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="https://example.com, https://app.example.com"
              />
              <span className="text-xs text-gray-400">
                URL через запятую
              </span>
            </label>

            {editingId && (
              <div className="mt-3 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.autofixEnabled}
                    onChange={(e) =>
                      setForm({ ...form, autofixEnabled: e.target.checked })
                    }
                    className="rounded border-gray-300"
                  />
                  Авто-фикс
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
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
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full md:w-auto rounded-md border border-gray-300 px-4 py-2 md:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full md:w-auto rounded-md bg-gray-900 px-4 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
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

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
          value ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}
