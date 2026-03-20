import { useEffect, useRef, useState, useCallback, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Fancybox } from '@fancyapps/ui';
import '@fancyapps/ui/dist/fancybox/fancybox.css';
import { api } from '../lib/api';
import { formatDate } from '../lib/date';
import { isAdmin, storageUrl } from '../lib/auth';
import { useSSE, type SSEEventType } from '../hooks/useSSE';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import Labels, { parseLabels } from '../components/Labels';
import SessionPlayer from '../components/SessionPlayer';

interface Note {
  id: number;
  content: string;
  type: string;
  userName: string | null;
  createdAt: string;
}

interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ItemData {
  id: string;
  projectId: string;
  message: string;
  status: string;
  priority: string | null;
  labels: string | null;
  pageUrl: string | null;
  cssSelector: string | null;
  elementText: string | null;
  elementHtml: string | null;
  viewportWidth: number | null;
  viewportHeight: number | null;
  screenshotPath: string | null;
  sessionRecordingPath: string | null;
  metadata: string | null;
  reporterName: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  branchName: string | null;
  mrUrl: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  resolvedById: string | null;
  createdAt: string;
  updatedAt: string;
  notes: Note[];
}

interface ParsedMetadata {
  browser?: string;
  os?: string;
  language?: string;
  devicePixelRatio?: string;
  screenResolution?: string;
  timezone?: string;
}

const noteTypeColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-700',
  system: 'bg-gray-100 text-gray-600',
  ai: 'bg-purple-100 text-purple-700',
  resolution: 'bg-green-100 text-green-700',
};

function parseMetadata(raw: string | null): ParsedMetadata | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed as ParsedMetadata;
    return null;
  } catch {
    return null;
  }
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const admin = isAdmin();
  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Resolve modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [branchName, setBranchName] = useState('');
  const [mrUrl, setMrUrl] = useState('');

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editLabels, setEditLabels] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Assignee state
  const [teamUsers, setTeamUsers] = useState<UserListItem[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);

  async function loadItem() {
    try {
      setLoading(true);
      const data = await api<ItemData>('/api/items/get', { id });
      setItem(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить задачу');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const res = await api<{ items: UserListItem[] }>('/api/users/list', { perPage: 100 });
      setTeamUsers(res.items);
    } catch {
      // Users list not available (non-admin) — ignore
    }
  }

  useEffect(() => {
    loadItem();
    if (admin) loadUsers();
  }, [id]);

  // SSE: real-time updates for this item
  const handleSSEEvent = useCallback((event: SSEEventType, data: unknown) => {
    const d = data as Record<string, unknown> | null;
    if (!d) return;

    // Item deleted → navigate back
    if (event === 'item.deleted' && d.itemId === id) {
      navigate('/items');
      return;
    }

    // Any change to this item → refetch
    const itemObj = d.item as Record<string, unknown> | undefined;
    if (itemObj?.id === id || d.itemId === id) {
      loadItem();
    }
  }, [id, navigate]);

  useSSE({ onEvent: handleSSEEvent });

  // Fancybox for screenshot zoom
  useEffect(() => {
    Fancybox.bind('[data-fancybox]', {});
    return () => { Fancybox.destroy(); };
  }, [item]);

  async function handleAction(
    action: 'claim' | 'cancel' | 'update-status',
    extra?: Record<string, unknown>,
  ) {
    if (!item) return;
    setActionLoading(true);
    try {
      if (action === 'claim') {
        await api('/api/items/claim', { id: item.id });
      } else if (action === 'cancel') {
        await api('/api/items/cancel', { id: item.id });
      } else if (action === 'update-status') {
        await api('/api/items/update-status', { id: item.id, ...extra });
      }
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolve() {
    if (!item) return;
    setActionLoading(true);
    try {
      await api('/api/items/resolve', {
        id: item.id,
        resolutionNote: resolutionNote || undefined,
        branchName: branchName || undefined,
        mrUrl: mrUrl || undefined,
      });
      setShowResolveModal(false);
      setResolutionNote('');
      setBranchName('');
      setMrUrl('');
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    if (!window.confirm('Удалить баг? Это действие нельзя отменить.')) return;
    setActionLoading(true);
    try {
      await api('/api/items/delete', { id: item.id });
      navigate('/items');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
      setActionLoading(false);
    }
  }

  async function handleReopen() {
    if (!item) return;
    setActionLoading(true);
    try {
      await api('/api/items/reopen', { id: item.id });
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setActionLoading(false);
    }
  }

  function startEditing() {
    if (!item) return;
    setEditMessage(item.message);
    setEditPriority(item.priority ?? 'medium');
    setEditLabels(parseLabels(item.labels).join(', '));
    setEditing(true);
  }

  async function handleEditSave() {
    if (!item || !editMessage.trim()) return;
    setEditSaving(true);
    try {
      const labelsArr = editLabels
        .split(',')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      await api('/api/items/update', {
        id: item.id,
        message: editMessage.trim(),
        priority: editPriority,
        labels: labelsArr,
      });
      setEditing(false);
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAssigneeChange(assigneeId: string) {
    if (!item) return;
    setAssigneeLoading(true);
    try {
      await api('/api/items/update', {
        id: item.id,
        assigneeId: assigneeId || null,
      });
      await loadItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка назначения');
    } finally {
      setAssigneeLoading(false);
    }
  }

  const notesRef = useRef<HTMLDivElement>(null);

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!item || !noteContent.trim()) return;
    setNoteSaving(true);
    try {
      await api('/api/items/add-note', {
        itemId: item.id,
        content: noteContent.trim(),
      });
      setNoteContent('');
      // Add note to local state without full reload to preserve scroll
      const getRes = await api<{ notes: typeof item.notes }>('/api/items/get', { id: item.id });
      setItem((prev) => prev ? { ...prev, notes: getRes.notes } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить заметку');
    } finally {
      setNoteSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 text-gray-400">Загрузка...</div>
    );
  }

  if (error && !item) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!item) return null;

  const screenshotUrl = item.screenshotPath
    ? storageUrl(item.screenshotPath)
    : null;
  const recordingUrl = item.sessionRecordingPath
    ? storageUrl(item.sessionRecordingPath)
    : null;

  const viewportStr = item.viewportWidth && item.viewportHeight
    ? `${item.viewportWidth}×${item.viewportHeight}`
    : null;

  const meta = parseMetadata(item.metadata);

  const isTerminal = item.status === 'done' || item.status === 'cancelled';

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        {/* Back button — sticky on mobile */}
        <div className="sticky top-0 z-10 -mx-4 mb-3 bg-gray-50 px-4 py-2 md:static md:mx-0 md:bg-transparent md:p-0 md:mb-3">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Назад
          </button>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 text-sm text-gray-500">
              <StatusBadge status={item.status} />
              <PriorityBadge priority={item.priority} />
              <span className="font-mono text-xs">#{item.id.slice(0, 8)}</span>
              <span>{formatDate(item.createdAt)}</span>
            </div>
            {parseLabels(item.labels).length > 0 && (
              <div className="mt-1.5">
                <Labels labels={parseLabels(item.labels)} />
              </div>
            )}
            {editing ? (
              <div className="mt-2 space-y-3">
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  rows={4}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-xs font-medium text-gray-500">Приоритет</span>
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    >
                      <option value="critical">Критический</option>
                      <option value="high">Высокий</option>
                      <option value="medium">Средний</option>
                      <option value="low">Низкий</option>
                    </select>
                  </label>
                  <label className="flex flex-1 items-center gap-2 text-sm text-gray-700">
                    <span className="text-xs font-medium text-gray-500 shrink-0">Метки</span>
                    <input
                      type="text"
                      value={editLabels}
                      onChange={(e) => setEditLabels(e.target.value)}
                      placeholder="баг, UI, срочно"
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleEditSave}
                    disabled={editSaving || !editMessage.trim()}
                    className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {editSaving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    disabled={editSaving}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-start gap-2">
                <div className="text-sm md:text-base text-gray-800 break-words whitespace-pre-line leading-relaxed">
                  {item.message}
                </div>
                {admin && !isTerminal && (
                  <button
                    onClick={startEditing}
                    className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
                    title="Редактировать"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action buttons — full-width stacked on mobile, inline on desktop */}
          <div className="flex flex-col gap-2 md:flex-row md:flex-shrink-0 md:flex-wrap">
            {item.status === 'new' && (
              <>
                <button
                  onClick={() => handleAction('claim')}
                  disabled={actionLoading}
                  className="w-full md:w-auto rounded-md bg-blue-600 px-3 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Взять в работу
                </button>
                <button
                  onClick={() => handleAction('cancel')}
                  disabled={actionLoading}
                  className="w-full md:w-auto rounded-md border border-gray-300 px-3 py-2 md:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Отменить
                </button>
              </>
            )}
            {item.status === 'in_progress' && (
              <>
                <button
                  onClick={() =>
                    handleAction('update-status', { status: 'review' })
                  }
                  disabled={actionLoading}
                  className="w-full md:w-auto rounded-md bg-purple-600 px-3 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  На ревью
                </button>
                <button
                  onClick={() => setShowResolveModal(true)}
                  disabled={actionLoading}
                  className="w-full md:w-auto rounded-md bg-green-600 px-3 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Готово
                </button>
                <button
                  onClick={() => handleAction('cancel')}
                  disabled={actionLoading}
                  className="w-full md:w-auto rounded-md border border-gray-300 px-3 py-2 md:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Отменить
                </button>
              </>
            )}
            {item.status === 'review' && (
              <>
                <button
                  onClick={() =>
                    handleAction('update-status', { status: 'in_progress' })
                  }
                  disabled={actionLoading}
                  className="w-full md:w-auto rounded-md border border-gray-300 px-3 py-2 md:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Вернуть в работу
                </button>
                <button
                  onClick={() => setShowResolveModal(true)}
                  disabled={actionLoading}
                  className="w-full md:w-auto rounded-md bg-green-600 px-3 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Готово
                </button>
              </>
            )}
            {/* Reopen button for done/cancelled — admin only */}
            {isTerminal && admin && (
              <button
                onClick={handleReopen}
                disabled={actionLoading}
                className="w-full md:w-auto rounded-md bg-yellow-500 px-3 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
              >
                Переоткрыть
              </button>
            )}
            {/* Delete button — admin only */}
            {admin && (
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="w-full md:w-auto rounded-md bg-red-600 px-3 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Info grid — single column on mobile, 2 cols on desktop */}
      <div className="mb-4 md:mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 rounded-lg border border-gray-200 bg-white p-3 md:p-4">
        <InfoRow label="URL страницы" value={item.pageUrl} link />
        <InfoRow label="CSS-селектор" value={item.cssSelector} mono />
        <InfoRow label="Элемент" value={item.elementText} />
        <InfoRow label="Разрешение" value={viewportStr} />
        <InfoRow label="Автор" value={item.reporterName} />
        {/* Assignee — admin gets a dropdown, others see static text */}
        {admin && teamUsers.length > 0 ? (
          <div>
            <dt className="text-xs font-medium text-gray-500">Исполнитель</dt>
            <dd className="mt-0.5">
              <select
                value={item.assigneeId ?? ''}
                onChange={(e) => handleAssigneeChange(e.target.value)}
                disabled={assigneeLoading}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
              >
                <option value="">Не назначен</option>
                {teamUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </dd>
          </div>
        ) : (
          <InfoRow label="Исполнитель" value={item.assigneeName} />
        )}
      </div>

      {/* Metadata / environment info */}
      {meta && (
        <div className="mb-4 md:mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 rounded-lg border border-gray-200 bg-white p-3 md:p-4">
          <div className="col-span-2 md:col-span-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Окружение</h3>
          </div>
          {meta.browser && <InfoRow label="Браузер" value={meta.browser} />}
          {meta.os && <InfoRow label="ОС" value={meta.os} />}
          {meta.screenResolution && <InfoRow label="Экран" value={meta.screenResolution} />}
          {meta.timezone && <InfoRow label="Часовой пояс" value={meta.timezone} />}
          {meta.language && <InfoRow label="Язык" value={meta.language} />}
          {meta.devicePixelRatio && <InfoRow label="DPR" value={meta.devicePixelRatio} />}
        </div>
      )}

      {item.elementHtml && (
        <div className="mb-4 md:mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            HTML элемента
          </h3>
          <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            <code>{item.elementHtml}</code>
          </pre>
        </div>
      )}

      {/* Screenshot with lightbox */}
      {screenshotUrl && (
        <div className="mb-4 md:mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-700">Скриншот</h3>
          <div className="rounded-lg border border-gray-200 overflow-auto max-h-[400px]">
            <a href={screenshotUrl} data-fancybox="screenshot" data-caption="Скриншот страницы">
              <img
                src={screenshotUrl}
                alt="Скриншот"
                className="w-full h-auto cursor-zoom-in hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
          <p className="mt-1 text-xs text-gray-400">Нажмите для увеличения. Скролл для просмотра.</p>
        </div>
      )}

      {/* Resolution section — shown when status is done */}
      {item.status === 'done' && (item.branchName || item.mrUrl || item.resolvedAt || item.resolutionNote) && (
        <div className="mb-4 md:mb-6 rounded-lg border border-green-200 bg-green-50 p-3 md:p-4">
          <h3 className="mb-3 text-sm font-medium text-green-800">Решение</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {item.branchName && (
              <div>
                <dt className="text-xs font-medium text-green-700">Ветка</dt>
                <dd className="mt-0.5 text-sm text-green-900 font-mono break-all">{item.branchName}</dd>
              </div>
            )}
            {item.mrUrl && (
              <div>
                <dt className="text-xs font-medium text-green-700">Merge Request</dt>
                <dd className="mt-0.5 text-sm break-all">
                  <a
                    href={item.mrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {item.mrUrl}
                  </a>
                </dd>
              </div>
            )}
            {item.resolvedAt && (
              <div>
                <dt className="text-xs font-medium text-green-700">Дата решения</dt>
                <dd className="mt-0.5 text-sm text-green-900">{formatDate(item.resolvedAt)}</dd>
              </div>
            )}
            {item.resolutionNote && (
              <div className="md:col-span-2">
                <dt className="text-xs font-medium text-green-700">Комментарий</dt>
                <dd className="mt-0.5 text-sm text-green-900 whitespace-pre-wrap">{item.resolutionNote}</dd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session recording — full width with scroll on mobile */}
      {recordingUrl && (
        <div className="mb-4 md:mb-6 overflow-x-auto">
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Запись сессии
          </h3>
          <SessionPlayer recordingPath={recordingUrl} />
        </div>
      )}

      {/* Notes timeline — full width */}
      <div className="mb-4 md:mb-6" ref={notesRef}>
        <h3 className="mb-3 text-sm font-medium text-gray-700">Заметки</h3>
        <div className="space-y-3">
          {item.notes.length === 0 ? (
            <p className="text-sm text-gray-400">Нет заметок</p>
          ) : (
            item.notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5 md:gap-2 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {note.userName ?? 'System'}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      noteTypeColors[note.type] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {{ comment: 'Комментарий', status_change: 'Статус', assignment: 'Назначение' }[note.type] || note.type}
                  </span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Add note form — full width */}
        <form onSubmit={handleAddNote} className="mt-4">
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Добавить заметку..."
            rows={3}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
          <button
            type="submit"
            disabled={noteSaving || !noteContent.trim()}
            className="mt-2 w-full md:w-auto rounded-md bg-gray-900 px-4 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
             {noteSaving ? 'Отправка...' : 'Отправить'}
          </button>
        </form>
      </div>

      {/* Resolve modal — full screen on mobile, centered on desktop */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div className="w-full md:max-w-md rounded-t-xl md:rounded-lg border border-gray-200 bg-white p-5 md:p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Завершить задачу
            </h3>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Комментарий к решению
              </span>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-gray-700">
                Название ветки
              </span>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="fix/issue-123"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-sm font-medium text-gray-700">Ссылка на MR</span>
              <input
                type="url"
                value={mrUrl}
                onChange={(e) => setMrUrl(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="https://gitlab.com/..."
              />
            </label>
            <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
              <button
                onClick={() => setShowResolveModal(false)}
                className="w-full md:w-auto rounded-md border border-gray-300 px-4 py-2 md:py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleResolve}
                disabled={actionLoading}
                className="w-full md:w-auto rounded-md bg-green-600 px-4 py-2 md:py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Сохранение...' : 'Завершить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  link,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  link?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-gray-800 break-all ${mono ? 'font-mono' : ''}`}
      >
        {link ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
