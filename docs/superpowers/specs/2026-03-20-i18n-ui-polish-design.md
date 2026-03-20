# i18n + UI Polish — Design Spec

## Goal

Add Russian/English/Uzbek (Latin) localization across dashboard, widget, and server error messages. Unify dashboard UI patterns: page descriptions, shared components, consistent text.

## Scope

- Dashboard: 6 pages, 7 components, 2 lib files — ~300 hardcoded strings
- Widget: 6 source files — ~30 strings
- Server: error messages + auto-notes — ~40 strings
- Supported locales: `ru`, `en`, `uz` (O'zbekcha, Latin script)

## Architecture

### 1. Dashboard i18n

**Files:**
```
dashboard/src/i18n/
  ru.json        — Russian translations
  en.json        — English translations
  uz.json        — Uzbek (Latin) translations
  index.ts       — useTranslation hook + LocaleProvider
```

**Hook API:**
```typescript
const { t, locale, setLocale } = useTranslation();
t('items.title')           // → "Задачи" | "Tasks" | "Topshiriqlar"
t('errors.INVALID_CREDENTIALS') // → translated error
```

**Locale resolution (priority order):**
1. `localStorage.getItem('scout_locale')`
2. `navigator.language` mapped to `ru|en|uz` (e.g. `uz-Latn` → `uz`, `en-US` → `en`)
3. Fallback: `ru`

**Language switcher:**
- Dropdown in Layout header, next to logout button
- Shows: `RU / EN / UZ`
- Saves to `localStorage('scout_locale')`
- Re-renders immediately (React context)

**Date formatting:**
- `date.ts` accepts locale parameter
- Locale map: `ru` → `ru-RU`, `en` → `en-US`, `uz` → `uz-Latn`

### 2. Widget i18n

**Approach:** Inline translations object (not external JSON — widget is a single IIFE bundle).

```typescript
const TRANSLATIONS = {
  ru: { 'picker.hint': 'Нажмите на элемент с ошибкой', ... },
  en: { 'picker.hint': 'Click on the element with the bug', ... },
  uz: { 'picker.hint': 'Xatolik bor elementni bosing', ... },
};
```

**Locale detection:** `navigator.language` → mapped to `ru|en|uz`, fallback `en`.

**Strings (~30):**
- Picker banner: hint text, cancel button
- Loading overlay: screenshot text
- Panel: title, labels, buttons, progress steps, element info labels
- Login form: title, subtitle, inputs, button, error
- Toasts: success, error, logout
- FAB: aria-label

### 3. Server Error Codes

**Current:** Mix of English strings and Russian strings.
**New:** All errors return a `code` field. Human-readable `message` stays English (for logs). Client translates `code`.

```json
// Before
{ "error": "Invalid email or password" }

// After
{ "error": "Invalid email or password", "code": "INVALID_CREDENTIALS" }
```

**Error code catalog (~25 codes):**

| Code | Current message |
|------|----------------|
| `INVALID_CREDENTIALS` | Invalid email or password |
| `UNAUTHORIZED` | Missing or invalid Authorization header |
| `TOKEN_EXPIRED` | Invalid or expired token |
| `SESSION_EXPIRED` | Сессия истекла |
| `FORBIDDEN` | Forbidden |
| `NO_PROJECT_ACCESS` | Нет доступа к этому проекту |
| `NOT_FOUND` | Resource not found |
| `ITEM_NOT_FOUND` | Item not found |
| `PROJECT_NOT_FOUND` | Project not found |
| `USER_NOT_FOUND` | User not found |
| `WEBHOOK_NOT_FOUND` | Webhook not found |
| `DUPLICATE_EMAIL` | User with email already exists |
| `DUPLICATE_SLUG` | Project with slug already exists |
| `CANNOT_DELETE_SELF` | Cannot delete yourself |
| `PROJECT_HAS_ITEMS` | Cannot delete project with items |
| `INVALID_STATUS_TRANSITION` | Invalid status transition |
| `VALIDATION_FAILED` | Validation failed |
| `RATE_LIMITED` | Too many requests |
| `USER_INACTIVE` | User deactivated |
| `API_KEY_INVALID` | Invalid API key |
| `API_KEY_EXPIRED` | API key expired |
| `CONFLICT` | Conflict |

**Auto-notes in items service:** Currently write Russian text to DB (`"Статус: новые -> в работе"`). Change to structured format:
```json
{ "type": "status_change", "from": "new", "to": "in_progress" }
```
Dashboard renders translated text from the structured data.

### 4. UI Polish

**Page descriptions (added to all pages):**

| Page | Title | Description |
|------|-------|-------------|
| Items | items.title | items.description |
| ItemDetail | (item message as h1) | — |
| Projects | projects.title | projects.description |
| Users | users.title | users.description |
| Webhooks | webhooks.title | webhooks.description |

**Shared components extracted:**
- `Toggle` — extracted from Projects.tsx/Webhooks.tsx duplicates

**Unified patterns via i18n keys:**
- Confirm dialogs: `common.confirmDelete`
- Empty states: `common.noData`
- Loading: `common.loading`
- Save/Cancel: `common.save`, `common.cancel`
- Error fallback: `common.error`

### 5. JSON Structure

```
common.*           — shared: loading, save, cancel, delete, confirm, error, noData
nav.*              — layout navigation: items, projects, webhooks, users, profile, logout
auth.*             — login page: title, subtitle, email, password, button
items.*            — items list + detail: title, description, statuses, priorities, actions
projects.*         — projects CRUD: title, description, form fields
users.*            — users CRUD: title, description, form fields, roles
webhooks.*         — webhooks CRUD: title, description, events
errors.*           — server error code translations
meta.*             — metadata labels: browser, os, screen, timezone, language, dpr
notes.*            — note types: comment, status_change, assignment
```

## Out of Scope

- RTL layout support
- Pluralization rules
- Lazy loading of translation files
- Server-side rendered translations
- Admin UI for managing translations

## Implementation Order

1. Create i18n infrastructure (hook, provider, JSON files)
2. Server: add error codes to all error responses
3. Server: structured auto-notes
4. Dashboard: wire i18n into all pages + components
5. Dashboard: add page descriptions + UI polish
6. Widget: add inline translations
7. Update date.ts for locale-aware formatting
8. Add language switcher to Layout
