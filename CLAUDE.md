# Scout

Автономная система баг-трекинга с AI-агентом.

## Стек

| Компонент | Технология |
|-----------|-----------|
| Backend | Hono + Drizzle + SQLite (better-sqlite3) |
| Dashboard | React 19 + Vite + Tailwind CSS v4 |
| Widget | Vanilla TS + Shadow DOM + IIFE (rrweb + html2canvas) |
| Валидация | Zod |
| Тесты | Vitest |
| Пакетный менеджер | pnpm (workspace: dashboard, widget) |

## Команды

| Действие | Команда |
|----------|---------|
| Dev (API) | `pnpm dev` |
| Dev (всё) | `pnpm dev:all` |
| Build | `pnpm build` |
| Production | `pnpm start` |
| Тесты | `pnpm test` |
| Typecheck | `pnpm typecheck` |
| DB push schema | `pnpm db:push` |
| DB seed | `pnpm db:seed` |
| Оркестратор | `pnpm orchestrator` |

## Структура

```
server/          — Hono API (порт 10009)
dashboard/       — React SPA (pnpm workspace: scout-dashboard)
widget/          — IIFE bundle (pnpm workspace: scout-widget)
orchestrator/    — AI-агент workflow
test/            — Vitest тесты
demo/            — Demo-стенд для тестирования виджета
data/            — SQLite БД (gitignored)
storage/         — Скриншоты + recordings (gitignored)
```

## API

Все endpoints POST, JSON body, Bearer JWT token. Префикс `/api/`.

- Auth: `/api/auth/login`, `/api/auth/me`
- Items: create, list, get, count, claim, resolve, cancel, update-status, add-note
- Projects: create, list, get, update, delete (list — все роли, остальное admin)
- Users: create, list, get, update, delete (admin only)

## Роли

| Роль | Доступ |
|------|--------|
| admin | Всё |
| member | Создание items, просмотр |
| agent | Чтение, claim, resolve, add-note |

## Статусы items

`new` → `in_progress` → `review` → `done`. Также: `new`/`in_progress` → `cancelled`, `review` → `in_progress`.

## Anti-patterns

- НЕ `as any`, `@ts-ignore`, `@ts-expect-error`
- НЕ удалять тесты
- НЕ пустые catch-блоки
- НЕ коммитить без `pnpm typecheck && pnpm test`

## Язык

- UI: русский
- Код, коммиты, переменные: английский
- Auto-notes в items service: русский
