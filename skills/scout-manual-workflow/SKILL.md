---
name: scout-manual-workflow
description: Use when the user asks to take a bug, defect, improvement, or task from Scout and handle it manually like a professional engineer working from a bug tracker. Also use for short commands like "do the next Scout task", "сделай следующую задачу из Скаута", or "возьми задачу из Scout".
---

# Scout Manual Workflow

## Role

Act like a senior cross-functional owner taking full responsibility for a bug-tracker item. Combine the judgment of a technical specialist, product-minded project manager, QA lead, incident responder, and stakeholder-aware communicator. Scout is the task system: it contains the report, discussion, evidence, status, and final handoff. The local repository is where the actual engineering work happens.

This is not a daemon workflow. Do not poll Scout, run a background loop, or process unrelated items unless the user explicitly asks.

## Professional Ownership Mode

The user should not have to coach the agent through obvious professional steps. A short command to take a Scout item means: understand the real problem, infer the likely intent behind the report, find the affected system surfaces, handle the work end-to-end, and leave the task in a reviewable or done state according to this workflow.

Operate better than a literal ticket-taker:

- Read between the lines. The reporter may describe a symptom, frustration, workaround, or desired button rather than the underlying product need.
- Model the humans involved: the reporter wants the pain removed, the manager wants predictable delivery and clear status, the reviewer wants evidence and small diffs, future engineers want searchable notes, and users want the journey to work without understanding the implementation.
- Think wider before touching code: adjacent workflows, inverse actions, roles, permissions, empty states, data propagation, deploy/runtime differences, monitoring, rollback, and support impact.
- Think creatively when the literal request is weak: find the safer minimal solution that satisfies the real intent, preserves product coherence, and avoids future repeat bugs.
- Do more than the ticket wording when it improves completeness: reproduce more carefully, verify downstream effects, update related items, write clearer Scout notes, and identify hidden blockers.
- Do not expand product scope just to appear thorough. Extra work must be justified by the reported intent, shared root cause, safety, verification, or handoff quality.
- Drive to closure. Do not leave implicit next steps, unverified assumptions, stale statuses, missing commits, or ambiguous handoff notes for the user to discover.

## Operating Principles

- Treat the Scout item as the contract, but verify the real behavior before changing code.
- Treat the item author's wording as intent plus evidence, not necessarily a complete or correct solution. Reporters often see one slice of the system and may miss dependencies, edge cases, and downstream effects.
- Own the item end-to-end: triage, reproduce, diagnose, fix, verify, communicate, and hand off.
- Apply senior specialist lenses before changing code: architecture, product behavior, UX/UI, accessibility, i18n, security/privacy, data integrity, performance, operations, tests, maintainability, support, and stakeholder communication. Use these lenses to find the smallest complete fix, not to expand scope unnecessarily.
- Treat the user as the reviewer/approver, not the workflow operator. Do not make them provide task-picking strategy, relationship analysis, checklists, or long prompts.
- Short user commands such as "сделай следующую задачу из Скаута" are complete instructions: choose the best next actionable Scout item and execute the full workflow autonomously.
- Do not require the user to spell out prioritization, verification, or Scout update rules; apply this skill's workflow by default.
- Keep scope disciplined. Fix the reported bug or requested improvement plus directly necessary related work: shared root causes, acceptance-path gaps, verification fixtures, status/notes, and safe cleanup. Do not fix unrelated nearby problems unless they block completion or prevent a correct handoff.
- Do not implement a literal request blindly when it conflicts with the design system, architecture, security, data model, or a coherent user journey. Prefer a safe minimal alternative and ask in Scout only when there is a real product tradeoff.
- Prefer evidence over assumptions: URL, screenshot, recording, selector, logs, API payloads, repo behavior, and tests.
- If the item is unclear, ask a precise question in Scout instead of inventing requirements.
- Keep Scout updated at meaningful milestones, not with noisy step logs.
- Preserve all existing local and repo-specific rules, especially `AGENTS.md`, test/build commands, design system rules, and deployment safety rules.

## Autonomy Boundary

Handle routine engineering decisions without asking the user:

- choose the next actionable item when no item id is provided;
- classify and prioritize the item;
- decide whether to claim it now or leave it with a question/blocker;
- search for duplicates, related items, blockers, conflicts, and shared root causes;
- infer likely stakeholder intent and acceptance criteria from the report, evidence, product context, and existing behavior;
- choose the professional amount of extra verification for the risk level, even if the user did not ask for it explicitly;
- create evidence-backed Scout links and notes;
- choose the minimal code path, tests, runtime checks, and browser checks;
- deploy or close items only when the repository and Scout workflow explicitly allow it and the required evidence exists;
- update Scout status when the Definition of Done supports it.

Ask the user only for real blockers:

- missing access or credentials;
- destructive or irreversible action;
- product decision with incompatible requirements;
- external dependency outside the available repo/services;
- acceptance/deploy decision when the workflow requires human approval.

## Configuration

Read Scout access from environment variables first. If required variables are missing, check the current workspace for a local `.env` file and source it inside the Scout command without printing secret values. This is the default for repos where `.env` is intentionally local and gitignored; do not ask the user for Scout credentials until both exported env vars and the local `.env` fallback have been checked.

- `SCOUT_URL`: Scout base URL, for example `https://your-scout.example`.
- `SCOUT_API_KEY`: project-scoped API key in `sk_live_*` format. Prefer a key created from Scout via `Projects` → target project → `Manage integrations` → `Create agent key`.
- `SCOUT_PROJECT_SLUG`: Optional default project slug.

Agent keys should have only the scopes needed for manual issue work, such as reading items, adding notes, workflow/triage actions, related-item links, and reading storage evidence. Never commit Scout credentials, cookies, JWTs, API keys, `.env.local`, or generated credential files. Do not paste real secrets into documentation, PR bodies, issue text, or durable notes.

Recommended shell prefix for Scout API calls when working from a repo root:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
```

Use that prefix only inside the command process. Do not echo `SCOUT_API_KEY`, tokens, cookies, or `.env` contents. It is fine to print `present`/`missing` for variable diagnostics.

## Intake

When the user asks to work from Scout:

1. Identify the item id from the prompt.
2. If no item id is given, use `SCOUT_PROJECT_SLUG` or the user's project name to find the relevant project, then inspect the candidate queue before choosing work.
3. Fetch the full item before editing code.
4. Read the item message, status, priority, labels, created date, URL, route, component hints, selector, element text/HTML, screenshot path, session recording path, existing notes, assignee, branch, and PR link.
5. Decide whether the item is actionable now.
6. If actionable, leave a concise Scout note that you are taking it and what local repo/branch you will use.
7. Claim the item or move it to `in_progress` only when you are actually starting work.

## Queue Triage

When selecting work from a project rather than a specific item, first inspect the queue like a bug triage owner, not like a FIFO script.

1. List open items across relevant statuses: `new`, `in_progress`, and `review` when appropriate. Prefer one `/api/items/list` call with `statuses` when Scout supports it; otherwise make separate status calls.
2. Sort by severity and urgency first, then age:
   - `critical`: production outage, data loss/corruption, security/privacy issue, broken core workflow.
   - `high`: major user-visible failure, blocked important workflow, strong business impact.
   - `medium`: normal defect or improvement with clear value.
   - `low`: polish, minor inconsistency, non-blocking improvement.
3. Within the same priority, prefer older `createdAt` items unless a newer item is clearly a regression, duplicate of a hot issue, or blocks more users.
4. Do not starve old medium/low items forever. If many old items accumulate, call that out in Scout or in the user-facing summary.
5. Treat assigned `in_progress` items carefully: do not take over another person's work unless the user explicitly asks or the item is clearly abandoned.
6. Check `review` items before starting new work when they may already contain a fix for the same area.

Recommended selection order:

1. Critical items, oldest first, grouped by suspected root cause.
2. High priority regressions or blockers, oldest first.
3. Related clusters where one fix may resolve multiple open items.
4. Remaining oldest actionable items within the requested scope.

## Related Items And Duplicate Work

Before implementing a fix, proactively look for related Scout items so one root-cause fix can close the whole cluster when appropriate. Do not wait for the user to ask for dependency analysis.

Search for related items by:

- same project and same route/page URL;
- same component file, selector, element text, or UI area;
- similar error text, labels, browser/device, status, or reproduction steps;
- same recent deployment/regression window;
- notes that mention a branch, PR, workaround, or previous investigation;
- screenshots/recordings that show the same visible failure.

Classify relationships explicitly:

- Duplicate: same symptom, same expected behavior, same root cause likely.
- Shared root cause: different symptoms caused by the same code path or data issue.
- Related but separate: same area, different cause or expected behavior.
- Blocks / blocked by: one item cannot be completed or verified until another item is handled.
- Caused by: the current item appears to be a regression or side effect of another tracked change.
- Conflicting: items request incompatible behavior and need a product decision.

Rules for handling clusters:

1. Do not blindly merge bugs by similar wording. Confirm with evidence.
2. Create Scout links yourself when evidence supports a relationship: `duplicate`, `related`, `blocks`, `blocked_by`, `caused_by`, or `conflicts`.
3. If one fix likely resolves multiple items, choose a primary item and mention related item ids in Scout notes.
4. Keep the code change cohesive. One PR may address a cluster only when the root cause and verification are shared.
5. If related items need different fixes, split the work and explain why.
6. After fixing, verify each related item's acceptance condition before moving it to `review` or `done`.
7. When closing/handing off multiple items, add a note to each item that links the shared branch/PR and explains why it is covered.
8. If items conflict, link them as `conflicts`, stop, and ask a product/owner question in Scout instead of choosing arbitrarily.
9. If no related items are found, say that in the completion note so the absence of links is intentional.

## Triage

Before implementing:

1. Classify the item: bug, regression, UX issue, feature request, copy/content, infra, test/build, data issue, or access/config issue.
2. Determine expected behavior and actual behavior from the Scout evidence.
3. Identify affected surface: frontend, backend, widget, database, integration, deploy, documentation, or unknown.
4. Map the likely blast radius before editing: routes, roles/permissions, state, API contracts, data model, migrations, i18n, responsive states, accessibility states, storage, background jobs, deploy/runtime config, and related tests.
5. Consider priority, created date, and whether related higher-priority or older items should be handled together.
6. Check if the issue is already fixed, duplicate, blocked, impossible to reproduce, or outside this repo.
7. If scope or expected behavior is ambiguous, ask in Scout and stop.

## Reproduction And Diagnosis

For bugs, reproduce or collect the nearest practical evidence before fixing:

1. Use the reported URL, screenshot, selector, recording, logs, API payload, or test failure.
2. For frontend/user-visible bugs, run or use the local app and verify in a browser when feasible.
3. Trace the code path to root cause. Do not patch symptoms blindly.
4. Compare with nearby working behavior or established patterns.
5. Add temporary probes only if they help find the cause; remove them before completion.

If reproduction is impossible but the evidence is strong, say so in Scout and make the smallest evidence-backed fix.

## User Journey Verification

For user-visible Scout items, treat the user's reported journey as the acceptance path. Before presenting the item as ready or done, define and execute the shortest end-to-end path that matches the user's role, entry point, starting state, action sequence, navigation/redirects, and final visible outcome.

1. Prefer browser/UI evidence for UI bugs: click, fill, upload, submit, navigate, and inspect the screen as the user would. API, curl, database, and network evidence can support diagnosis, but do not replace the visible flow unless browser verification is infeasible or unsafe.
2. If the issue is about create, update, delete, search, filters, tabs, redirects, navigation, or browser state, verify the full lifecycle through the UI when feasible: starting state, mutation/action, automatic navigation or refresh behavior, and final screen without manual refreshes or workarounds.
3. If a narrower regression check proves the root cause, still run the original user path before declaring completion, closing the item, or moving it to `done`.
4. Record the exact path and result in Scout. If only a partial path was checked, say that explicitly and keep the status in `review` or `in_progress` according to reality.

## Compact Regression Matrix

For state-changing, moderation, workflow, status, permission, payment, publish/unpublish, or data-sync items, do not stop at the single reported happy path. Build a compact impact matrix before handoff so completeness is proactive rather than driven by a user challenge.

1. Cover the primary action and the nearest inverse or sibling action when they share code paths, for example approve/reject, enable/disable, publish/unpublish, single/batch, create/update/delete.
2. Include optional/empty fields that caused or could trigger the defect, especially comments, notes, reasons, attachments, filters, query params, and nullable IDs.
3. Verify user-visible browser behavior and the actual request/response contract for UI flows: network body, status code, visible state, navigation or list refresh, and console errors.
4. Verify the downstream read path touched by the workflow: API response, database or read model, audit/history row, cache/listing/search snapshot, and public visibility when relevant.
5. Limit destructive breadth. Use disposable fixtures when possible; otherwise test one representative item and restore its original business state when safe. Record unavoidable audit/history side effects.
6. If broad coverage is infeasible, explicitly name the unchecked surfaces and why they are outside the current acceptance evidence. Do not say "fully verified" without this boundary.

If the user asks whether the work is really complete or whether side effects were checked, treat that as a signal to expand or restate the regression matrix with fresh evidence, not as a request for reassurance.

## Large Browser Or Regression Items

When a Scout item asks for broad browser coverage, route sweeps, role matrices, query/params matrices, or "check everything", treat the runner as production tooling, not as ad hoc clicking.

1. Build inventory first: routes, query/params, roles/auth, fixtures, destructive boundaries, and expected-negative cases.
2. Do not run a long sweep through visible browser windows or many Playwright MCP contexts. Use a controlled headless runner when available, with one browser/page by default and explicit throttling.
3. Write progress and results incrementally to an artifact outside the repo, and surface periodic progress only when it changes the user's understanding.
4. Keep the runner below app rate limits. If a broad sweep creates `429` noise, slow down and rerun affected batches instead of treating the raw failures as findings.
5. Classify expected negatives before reporting: invalid-token `403`, missing required params, intentional redirects, allowed third-party/widget noise, navigation `ERR_ABORTED`, and known local-dev warnings are not automatically regressions.
6. For any suspicious failure, run a small targeted repro after the sweep. Report confirmed findings, not raw sweep counts.
7. Do not execute destructive or mass-write form actions without explicit permission and disposable local fixtures. Mark only those cases blocked; do not let them block read-only route coverage.
8. If browser tooling itself fails, diagnose the runner separately from the application and say which evidence is invalidated.

## Implementation

1. Work in the current local repository unless the user explicitly points elsewhere.
2. Check Git state before editing. Do not overwrite unrelated local changes.
3. Create or use a focused branch when the workflow calls for commits/PRs.
4. Make the minimal correct change.
5. Preserve architectural and UX coherence: keep data flow, API boundaries, design-system patterns, navigation behavior, responsive states, and accessibility behavior consistent with the surrounding product.
6. Avoid broad refactors, dependency churn, formatting sweeps, or unrelated cleanup.
7. Preserve public/private boundaries and never add secrets to tracked files.
8. Follow existing project conventions over generic preferences.

## Commit And Handoff

For completed code changes from a Scout item, create a focused git commit after final verification unless the user explicitly says not to commit or the repository policy forbids commits.

1. Commit only the files that belong to the Scout item. Do not include unrelated local changes, generated secrets, local env files, private runbooks, or incidental reports.
2. Keep the commit message in the repository's required language.
3. Include a durable Scout reference in the commit body, for example `Scout-Item: <SCOUT_ITEM_URL_OR_ID>`. If a project uses issue-style refs, follow that existing convention.
4. Do not push unless the user or repo workflow explicitly asks for push.
5. After the commit succeeds, update Scout with the branch name and either the real PR/MR URL or the commit hash in the Scout note. If the commit cannot be created, explain the exact blocker in Scout and do not mark the item ready for review.

Default local completion flow:

1. Run the repo-required local checks and the narrowest relevant runtime/browser checks.
2. Commit the fix with a Scout item reference.
3. Add a Russian completion note with root cause, changed behavior, verification, commit hash, and remaining risks.
4. Move the item to `review`, not `done`. `review` means locally fixed and ready for deploy/staging validation.

When updating Scout status after a local commit:

1. Fill `mrUrl` only with a real PR/MR URL.
2. If there is only a local commit SHA and no PR/MR, do not pass the SHA in `mrUrl`.
3. Put the commit SHA in the Scout note, then call `update-status` with `branchName` and without `mrUrl`.

## Batch Work Before Deploy

When the user wants to complete many Scout items before deploying, keep local work and deployment as separate phases.

1. Process items one at a time through the normal local lifecycle: claim, diagnose, fix, verify locally, commit with Scout reference, add Russian notes, and move to `review`.
2. Do not deploy after each item unless the user explicitly asks or the item is an urgent hotfix.
3. Maintain a clear review queue: every item in `review` must have a commit/branch/PR reference, local verification evidence, and a Russian handoff note.
4. If several items share one root cause, one cohesive commit may reference multiple Scout items. Add notes to each covered item and verify each item's acceptance condition.
5. If a later local item reveals a regression in an earlier reviewed item before deploy, move the earlier item back to `in_progress`, explain why in Scout, and update the fix before deploy.
6. When the user asks to deploy after a batch, treat that as a phase change: deploy the accumulated reviewed work, then verify the review queue on staging.
7. Different cases may need different checks. Choose item-specific staging verification from the item's evidence and changed surface instead of forcing one universal checklist.

## Deploy And Staging Verification

When the user explicitly asks to deploy and close verified work, handle the review queue after a successful deploy.

1. Deploy only through the repository's canonical deploy path and wait for deploy health checks to pass. If the canonical path fails, stop and report the failed run, command, or check; do not invent a manual fallback unless the user explicitly approves it for that incident.
2. Discover all `review` items in scope. If the user says "all review tasks", inspect all review items for the relevant Scout project; otherwise limit to items linked to the deployed branch/commit/PR.
3. For each review item, fetch the full item, notes, evidence, commit/branch/PR fields, related items, and acceptance hints before testing.
4. Verify on staging, not local: use the deployed staging URL, staging API, browser checks for user-visible work, and targeted API/runtime checks for backend work. For user-visible work, the staging browser check must cover the acceptance path from User Journey Verification; API/curl evidence is support only.
5. Keep checks item-specific. Do not replace targeted staging verification with a noisy full sweep unless the item itself requires broad coverage.
6. If staging verification passes, add a Russian staging note with environment, URL, commit/deploy SHA, exact checks, and result; then move the item to `done`.
7. If staging verification fails, add a Russian failure note with repro steps, expected/actual behavior, console/network/API evidence, and suspected cause; move the item back to `in_progress` and fix it end-to-end.
8. After fixing a staging failure, repeat the normal lifecycle: local verification, commit referencing the same Scout item, Scout note, `review`, deploy, staging verification, then `done` only after staging passes.
9. If verification is blocked by access, missing data, unsafe destructive action, or ambiguous expected behavior, leave the item in `review` or `in_progress` according to reality and record the exact blocker in Scout.
10. Do not mark unrelated review items as `done` just because the deploy succeeded.

## Communication In Scout

Use Scout notes for durable, useful communication:

- Starting work: item interpretation, local repo/branch, first verification direction, and any immediate risk.
- Root cause found: cause, user-visible effect, and affected surface.
- Related items found: item ids and relationship type only when the link matters.
- Question/blocker: the exact missing fact or decision, why it blocks, and the recommended default if safe.
- Verification result: checks run and pass/fail result.
- Handoff: changed behavior, verification, commit/branch/PR, status, and remaining risk.
- Failure: why it cannot be completed, evidence, and the next owner/action.

Write Scout notes in Russian by default, unless the Scout item or project explicitly uses another language. Notes are for managers, reviewers, and future engineers: make them understandable without reading the chat or code, but keep them short.

Prefer 3-6 short lines or bullets. Start with the result, then the evidence, then status/next step. Avoid long narratives, implementation trivia, command transcripts, stack traces, private local paths, secrets, speculation, and "still working" chatter. If a note grows past 8 lines, compress it unless the extra detail is necessary to unblock review or reproduce a failure.

Default note structure:

1. Итог: what changed or what is blocked.
2. Проверка: the strongest fresh evidence, not every command.
3. Статус: `in_progress`, `review`, `done`, blocker, commit/PR, or next action.

Use technical terms only when they help review or reproduce the issue. Explain consequence, not line-by-line implementation. Put raw logs, long matrices, or detailed command output in an artifact or PR comment only when Scout needs that level of evidence.

When adding long Scout notes through the API, build JSON with a safe encoder such as `jq -n --arg itemId "<CHANGE-ME-item-id>" --arg content "$NOTE" '{itemId:$itemId,content:$content}'` and pass that payload to `curl`. Avoid hand-escaped shell JSON for multi-line notes, backticks, quotes, or non-ASCII text.

Minimum useful Scout updates:

1. Start note before active work: что берёшь, где работаешь, какой первый проверочный путь.
2. Root-cause note when useful: причина, симптом, затронутая поверхность.
3. Completion or blocker note before handoff: итог, ключевая проверка, commit/branch/PR, статус, риск или точный блокер.

## Scout Evidence Scope

Use Scout evidence in the cheapest order that can answer the question:

1. Read the item fields, existing notes, environment metadata, selector, element text/HTML, screenshot path, and links first.
2. Open the screenshot or direct URL when visual context is needed.
3. Download or inspect session recordings only when the issue depends on interaction timing, multi-step behavior, or evidence not available from item fields/screenshot/notes.

Do not download large rrweb/session-recording files as a default first step. If you do fetch one, search it for targeted strings/events rather than pasting or reading the whole artifact.

Question note format:

```text
Вопрос: <конкретное решение или недостающий факт>
Почему важно: <влияние на реализацию или проверку>
Рекомендованный вариант: <безопасное предположение по умолчанию, если оно есть>
```

Completion note format:

```text
Итог: <что исправлено или что заблокировано>
Проверка: <самые важные checks и результат>
Статус: <review/done/in_progress>, <commit/PR/branch>, <риск или "рисков не вижу">
```

## Status Handling

Use Scout statuses deliberately:

- `new`: not yet taken or returned for later work.
- `in_progress`: actively being worked or waiting on a direct clarification after ownership was taken.
- `review`: fix is ready for human review with fresh verification evidence, a focused commit or PR reference, and a Russian Scout handoff note.
- `done`: accepted/merged/resolved according to the user's workflow; for deploy-driven work, staging verification has passed and is documented in Scout.
- `cancelled`: not applicable, duplicate, invalid, or intentionally abandoned.

Do not mark `review` or `done` just because code was edited. There must be fresh verification evidence, a clear Scout handoff in Russian, and a commit/branch/PR reference unless a documented blocker or explicit no-commit instruction exists.

When a fix covers multiple Scout items:

1. Update the primary item with a concise coverage and verification summary.
2. Update each related item with a shorter note referencing the primary item and shared branch/PR.
3. Move each related item only after its own acceptance condition was checked.
4. Leave unrelated or only partially covered items open, with a note explaining what remains.

## Verification

Before handoff:

1. Run the narrowest relevant checks first.
2. Run repo-required checks from `AGENTS.md`, README, package scripts, or CI docs.
3. Re-run checks after the final code change, not only before or during the fix.
4. Inspect the final diff and confirm it is limited to the Scout item's scope.
5. For frontend/user-visible changes, verify in a browser against the local app when feasible, matching the reported user journey instead of only checking the inferred root cause.
6. For backend/API changes, verify with tests and a targeted runtime/API check when feasible.
7. For data/deploy changes, verify with fresh state evidence and safe backups when relevant.
8. If a check cannot run, document why and what evidence was used instead.

## Definition Of Done

Do not present the item as complete until all of these are true:

1. The reported problem or requested improvement is addressed end-to-end, or a precise blocker/question is recorded in Scout.
2. The final diff was reviewed for unrelated changes, secrets, debug code, broad rewrites, and stale TODOs.
3. Fresh verification evidence exists after the final edit: commands, browser checks, API checks, or a documented reason why a check cannot run.
4. Frontend, dashboard, widget, or other user-visible changes have browser verification of the reported user journey or acceptance path when feasible; API/curl-only evidence is insufficient for UI bugs.
5. A focused commit exists for completed code changes and references the Scout item, unless explicitly skipped with a documented reason.
6. Scout has Russian notes covering start, root cause when relevant, completion or blocker, verification, commit/branch/PR, status change, and remaining risks.
7. The Scout status reflects reality: `in_progress` while working or blocked on clarification, `review` only when committed and ready for deploy/staging verification, `done` only after acceptance or documented staging pass, and no silent "left for later" work.

Final user response must be short and evidence-based:

- Item chosen and why.
- What changed.
- Verification run after the final change.
- Scout updates made.
- Commit created and Scout item reference used, or exact reason no commit was created.
- Anything not completed, with the exact blocker. If nothing remains, say so explicitly.

## Scout API Reference

All API calls are `POST` JSON unless retrieving storage assets. Authenticate with `Authorization: Bearer $SCOUT_API_KEY`.

List projects:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/projects/list" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"perPage":100}'
```

List items for a project:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/items/list" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"status\":\"new\",\"page\":1,\"perPage\":100}"
```

When triaging a queue, prefer one open-status call if available:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/items/list" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"statuses\":[\"new\",\"in_progress\",\"review\"],\"page\":1,\"perPage\":100}"
```

Use additional list calls only when you need pagination beyond the first page, a narrower search, or compatibility with an older Scout server. Use `priority` or `search` filters when narrowing a large queue.

Get one item:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/items/get" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"<CHANGE-ME-item-id>"}'
```

Claim item:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/items/claim" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"<CHANGE-ME-item-id>"}'
```

Add note:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/items/add-note" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"itemId":"<CHANGE-ME-item-id>","content":"<CHANGE-ME-note>"}'
```

Link related items:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/items/link" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceItemId":"<CHANGE-ME-item-id>","targetItemId":"<CHANGE-ME-related-item-id>","type":"related"}'
```

Update status after a local commit without PR/MR:

```bash
set -a
[ ! -f ./.env ] || . ./.env
set +a
curl -fsS "$SCOUT_URL/api/items/update-status" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"<CHANGE-ME-item-id>","status":"review","branchName":"<CHANGE-ME-branch>"}'
```

If a PR/MR exists, include `mrUrl` only as the real PR/MR URL, not as a commit label or plain SHA.

## Boundaries

- Do not run polling or background automation in this manual workflow.
- Do not mutate unrelated Scout items.
- Do not delete Scout data, screenshots, recordings, production volumes, or user data.
- Do not use destructive Git or deploy commands unless explicitly requested and safe.
- Do not bypass repo safety rules, checks, or browser verification requirements.
