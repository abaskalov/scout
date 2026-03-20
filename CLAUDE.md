# Scout

Автономная система баг-трекинга с AI-агентом.

## Команды

| Действие | Команда |
|----------|---------|
| Dev (API) | `pnpm dev` |
| Dev (всё) | `pnpm dev:all` |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Unit-тесты | `pnpm test` |
| E2E-тесты | `pnpm test:e2e` |
| DB seed | `pnpm db:seed` |
| DB миграция | `pnpm db:generate` (после изменения schema.ts) |
| Оркестратор | `pnpm orchestrator` |

## Структура

```
server/          — Hono API (порт 10009)
dashboard/       — React SPA (pnpm workspace: scout-dashboard)
widget/          — IIFE bundle (pnpm workspace: scout-widget)
orchestrator/    — AI-агент workflow
test/            — Vitest unit-тесты
e2e/             — Playwright E2E (18 тестов × 3 браузера)
drizzle/         — DB миграции (drizzle-kit)
demo/            — Demo-стенд для виджета
data/            — SQLite БД (gitignored)
storage/         — Скриншоты + recordings (gitignored)
```

## Workflow: код → тест → деплой

**ОБЯЗАТЕЛЬНЫЙ порядок. НЕ деплоить без локальной проверки.**

1. **Код** — реализация
2. **`pnpm typecheck && pnpm test`** — typecheck + unit-тесты
3. **`pnpm build`** — server + dashboard + widget
4. **Локальный smoke-test** — `pnpm dev`, проверить в браузере:
   - Dashboard: http://localhost:10009 (`admin@scout.local` / `admin`)
   - Widget: http://localhost:10009/demo/ (если менялся виджет)
   - DevTools Console — убедиться нет ошибок
5. **Коммит** — только после успешной проверки
6. **Push `dev`** — CI прогонит typecheck + тесты
7. **Merge `dev` → `main` + push** — после зелёного CI
8. **Деплой** — автоматический (GitHub Actions → Docker → watchtower)

**Smoke-test обязателен при изменениях в:** widget/, dashboard UI, server routes/middleware, CORS/SSO.

**Можно пропустить при:** только docs/тесты/CI конфиг.

## Сервер

| Хост | Доступ |
|------|--------|
| Production | `https://scout.kafu.kz` |
| SSH | `ssh kafu-scout` |
| Docker compose | `/opt/scout` на сервере |
| API docs | `https://scout.kafu.kz/api/docs` |

## API

POST, JSON body, `Bearer JWT` или API Key (`sk_live_*`). Префикс `/api/v1/` (или `/api/`). Серверные ошибки содержат поле `code` — клиент переводит по `errors.{CODE}` из i18n.

## Роли и доступ

| Роль | Доступ |
|------|--------|
| admin | Всё |
| member | Создание items, просмотр своих проектов |
| agent | Чтение, claim, resolve, add-note — свои проекты |

Доступ через `pivot_users_projects`. Admin видит всё.

## Статусы items

`new` → `in_progress` → `review` → `done`

Также: `new`/`in_progress` → `cancelled`, `review` → `in_progress`, `done`/`cancelled` → `new` (reopen).

## i18n

- **Dashboard**: `dashboard/src/i18n/` — `ru.json`, `en.json`, `uz.json` + `useTranslation()` hook
- **Widget**: `widget/src/i18n.ts` — встроенные переводы, auto-detect из `navigator.language`
- **Сервер**: ошибки с кодами (`INVALID_CREDENTIALS`, `NO_PROJECT_ACCESS`, ...), клиент переводит
- **Auto-notes**: structured JSON (`{"type":"status_change","from":"new","to":"in_progress"}`), dashboard рендерит по locale
- **Даты**: `date.ts` — locale-aware форматирование через `LOCALE_MAP`

## SSO (кросс-доменная авторизация)

Приоритет: cookie (поддомены `.avtozor.uz`) → popup SSO (кросс-домен) → iframe bridge → localStorage.

| Компонент | Путь |
|-----------|------|
| Iframe bridge | `GET /auth/sso` |
| Popup логин | `GET /auth/sso/popup?origin=...` |
| Widget auth | `widget/src/auth.ts` |

## Скриншоты (widget)

- **Библиотека**: `html2canvas-pro` (форк html2canvas с поддержкой oklch/oklab/color-mix)
- **Cross-origin iframes**: заменяются placeholder div'ами ПЕРЕД html2canvas, восстанавливаются ПОСЛЕ (Safari блокирует клонирование cross-origin iframe'ов)
- **Файл**: `widget/src/screenshot.ts`
- **Формат**: JPEG quality 0.85, base64 без data: prefix
- **iOS**: viewport-only capture (полная страница крашит canvas)
- **Storage**: `/storage/screenshots/*.jpg` — требует auth через `?token=` query param

## Session Replay (widget + dashboard)

- **Запись**: rrweb в виджете, gzip через fflate, 60с rolling buffer
- **Воспроизведение**: rrweb Replayer в dashboard (`SessionPlayer.tsx`)
- **CORS fix**: MutationObserver удаляет cross-origin `<link>` из replay iframe до загрузки
- **Storage**: `/storage/recordings/*.json` — требует auth через `?token=`

## Даты

UTC в API. `new Date().toISOString()` для новых записей. Dashboard парсит через `dashboard/src/lib/date.ts`.

## CI/CD

- Push `dev` → CI (typecheck + tests)
- Push `main` → CI → Docker build → deploy на scout.kafu.kz
- `concurrency: cancel-in-progress`

## Env vars (production)

| Переменная | Обязательна | Описание |
|------------|-------------|----------|
| `SCOUT_JWT_SECRET` | Да | JWT signing secret |
| `SCOUT_CORS_ORIGINS` | Нет | Comma-separated whitelist origin'ов |
| `SMTP_HOST` | Нет | SMTP для email |
| `SMTP_PORT` | Нет | Default: 587 |
| `SMTP_USER` | Нет | SMTP логин |
| `SMTP_PASS` | Нет | SMTP пароль |
| `SMTP_FROM` | Нет | Адрес отправителя |
| `SENTRY_DSN` | Нет | Sentry error tracking |
| `LOG_LEVEL` | Нет | pino log level (default: info) |

## Anti-patterns

- НЕ `as any`, `@ts-ignore`, `@ts-expect-error`
- НЕ удалять тесты
- НЕ пустые catch-блоки
- НЕ коммитить без `pnpm typecheck && pnpm test`
- НЕ деплоить без локального smoke-test для UI/widget
- НЕ пушить в main напрямую — только merge из dev

## Язык

- UI: ru/en/uz (i18n, переключатель в Layout)
- Код, коммиты, переменные: английский
- Серверные ошибки: английские + коды (клиент переводит)
