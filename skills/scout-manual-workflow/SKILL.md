---
name: scout-manual-workflow
description: Use when the user asks to take a bug, defect, improvement, or task from Scout and handle it manually like a professional engineer working from a bug tracker.
---

# Scout Manual Workflow

## Role

Act like a senior engineer taking ownership of a bug-tracker item. Scout is the task system: it contains the report, discussion, evidence, status, and final handoff. The local repository is where the actual engineering work happens.

This is not a daemon workflow. Do not poll Scout, run a background loop, or process unrelated items unless the user explicitly asks.

## Operating Principles

- Treat the Scout item as the contract, but verify the real behavior before changing code.
- Own the item end-to-end: triage, reproduce, diagnose, fix, verify, communicate, and hand off.
- Keep scope tight. Fix the reported bug or requested improvement, not nearby problems.
- Prefer evidence over assumptions: URL, screenshot, recording, selector, logs, API payloads, repo behavior, and tests.
- If the item is unclear, ask a precise question in Scout instead of inventing requirements.
- Keep Scout updated at meaningful milestones, not with noisy step logs.
- Preserve all existing local and repo-specific rules, especially `AGENTS.md`, test/build commands, design system rules, and deployment safety rules.

## Configuration

Read Scout access from environment variables or an explicitly provided local credential file outside Git:

- `SCOUT_URL`: Scout base URL, for example `https://your-scout.example`.
- `SCOUT_API_KEY`: project-scoped API key in `sk_live_*` format. Prefer a key created from Scout via `Projects` → target project → `Manage integrations` → `Create OpenCode key`.
- `SCOUT_PROJECT_SLUG`: Optional default project slug.
- `SCOUT_ITEM_ID`: Optional current item id.

OpenCode keys should have only the scopes needed for manual issue work, such as reading items, adding notes, workflow/triage actions, related-item links, and reading storage evidence. Never commit Scout credentials, cookies, JWTs, API keys, `.env.local`, or generated credential files. Do not paste real secrets into documentation, PR bodies, issue text, or durable notes.

## Intake

When the user asks to work from Scout:

1. Identify the item id from the prompt or `SCOUT_ITEM_ID`.
2. If no item id is given, use `SCOUT_PROJECT_SLUG` or the user's project name to find the relevant project, then inspect the candidate queue before choosing work.
3. Fetch the full item before editing code.
4. Read the item message, status, priority, labels, created date, URL, route, component hints, selector, element text/HTML, screenshot path, session recording path, existing notes, assignee, branch, and PR link.
5. Decide whether the item is actionable now.
6. If actionable, leave a concise Scout note that you are taking it and what local repo/branch you will use.
7. Claim the item or move it to `in_progress` only when you are actually starting work.

## Queue Triage

When selecting work from a project rather than a specific item, first inspect the queue like a bug triage owner, not like a FIFO script.

1. List open items across relevant statuses: `new`, `in_progress`, and `review` when appropriate.
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

Before implementing a fix, look for related Scout items so one root-cause fix can close the whole cluster when appropriate.

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
- Conflicting: items request incompatible behavior and need a product decision.

Rules for handling clusters:

1. Do not blindly merge bugs by similar wording. Confirm with evidence.
2. If one fix likely resolves multiple items, choose a primary item and mention related item ids in Scout notes.
3. Keep the code change cohesive. One PR may address a cluster only when the root cause and verification are shared.
4. If related items need different fixes, split the work and explain why.
5. After fixing, verify each related item's acceptance condition before moving it to `review` or `done`.
6. When closing/handing off multiple items, add a note to each item that links the shared branch/PR and explains why it is covered.
7. If items conflict, stop and ask a product/owner question in Scout instead of choosing arbitrarily.

## Triage

Before implementing:

1. Classify the item: bug, regression, UX issue, feature request, copy/content, infra, test/build, data issue, or access/config issue.
2. Determine expected behavior and actual behavior from the Scout evidence.
3. Identify affected surface: frontend, backend, widget, database, integration, deploy, documentation, or unknown.
4. Consider priority, created date, and whether related higher-priority or older items should be handled together.
5. Check if the issue is already fixed, duplicate, blocked, impossible to reproduce, or outside this repo.
6. If scope or expected behavior is ambiguous, ask in Scout and stop.

## Reproduction And Diagnosis

For bugs, reproduce or collect the nearest practical evidence before fixing:

1. Use the reported URL, screenshot, selector, recording, logs, API payload, or test failure.
2. For frontend/user-visible bugs, run or use the local app and verify in a browser when feasible.
3. Trace the code path to root cause. Do not patch symptoms blindly.
4. Compare with nearby working behavior or established patterns.
5. Add temporary probes only if they help find the cause; remove them before completion.

If reproduction is impossible but the evidence is strong, say so in Scout and make the smallest evidence-backed fix.

## Implementation

1. Work in the current local repository unless the user explicitly points elsewhere.
2. Check Git state before editing. Do not overwrite unrelated local changes.
3. Create or use a focused branch when the workflow calls for commits/PRs.
4. Make the minimal correct change.
5. Avoid broad refactors, dependency churn, formatting sweeps, or unrelated cleanup.
6. Preserve public/private boundaries and never add secrets to tracked files.
7. Follow existing project conventions over generic preferences.

## Communication In Scout

Use Scout notes for durable, useful communication:

- Starting work: mention local repo/branch and initial understanding.
- Root cause found: summarize the actual cause briefly.
- Related items found: list item ids and explain duplicate/shared/separate classification.
- Question/blocker: ask exactly what is needed to proceed.
- Verification result: list commands/browser checks and result.
- Handoff: link branch/commit/PR and summarize the fix.
- Failure: explain why it cannot be completed and what evidence exists.

Avoid noisy command transcripts, huge stack traces, private local paths unless necessary, secrets, speculative claims, or “still working” chatter.

Question note format:

```text
Question: <specific decision or missing fact>
Why it matters: <impact on implementation or verification>
Suggested default: <safe recommended assumption, if one exists>
```

Completion note format:

```text
Implemented: <short summary>
Root cause: <short cause, for bugs>
Verification: <commands and browser checks>
Branch/PR: <branch, commit, or PR URL if available>
Notes: <risks, skipped checks, or follow-up if any>
```

## Status Handling

Use Scout statuses deliberately:

- `new`: not yet taken or returned for later work.
- `in_progress`: actively being worked or waiting on a direct clarification after ownership was taken.
- `review`: fix is ready for human review, usually with a commit/branch/PR and verification evidence.
- `done`: accepted/merged/resolved according to the user's workflow.
- `cancelled`: not applicable, duplicate, invalid, or intentionally abandoned.

Do not mark `review` or `done` just because code was edited. There must be fresh verification evidence and a clear handoff.

When a fix covers multiple Scout items:

1. Update the primary item with the full implementation and verification summary.
2. Update each related item with a shorter note referencing the primary item and shared branch/PR.
3. Move each related item only after its own acceptance condition was checked.
4. Leave unrelated or only partially covered items open, with a note explaining what remains.

## Verification

Before handoff:

1. Run the narrowest relevant checks first.
2. Run repo-required checks from `AGENTS.md`, README, package scripts, or CI docs.
3. For frontend/user-visible changes, verify in a browser against the local app when feasible.
4. For backend/API changes, verify with tests and a targeted runtime/API check when feasible.
5. For data/deploy changes, verify with fresh state evidence and safe backups when relevant.
6. If a check cannot run, document why and what evidence was used instead.

## Scout API Reference

All API calls are `POST` JSON unless retrieving storage assets. Authenticate with `Authorization: Bearer $SCOUT_API_KEY`.

List projects:

```bash
curl -fsS "$SCOUT_URL/api/projects/list" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"perPage":100}'
```

List items for a project:

```bash
curl -fsS "$SCOUT_URL/api/items/list" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"status\":\"new\",\"page\":1,\"perPage\":100}"
```

Use additional list calls for `in_progress` and `review` when checking for overlap. Use `priority` or `search` filters when narrowing a large queue.

Get one item:

```bash
curl -fsS "$SCOUT_URL/api/items/get" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$SCOUT_ITEM_ID\"}"
```

Claim item:

```bash
curl -fsS "$SCOUT_URL/api/items/claim" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$SCOUT_ITEM_ID\"}"
```

Add note:

```bash
curl -fsS "$SCOUT_URL/api/items/add-note" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"itemId\":\"$SCOUT_ITEM_ID\",\"content\":\"<CHANGE-ME-note>\"}"
```

Link related items:

```bash
curl -fsS "$SCOUT_URL/api/items/link" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"sourceItemId\":\"$SCOUT_ITEM_ID\",\"targetItemId\":\"<CHANGE-ME-related-item-id>\",\"type\":\"related\"}"
```

Update status:

```bash
curl -fsS "$SCOUT_URL/api/items/update-status" \
  -H "Authorization: Bearer $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$SCOUT_ITEM_ID\",\"status\":\"review\",\"branchName\":\"<CHANGE-ME-branch>\",\"mrUrl\":\"<CHANGE-ME-pr-url>\"}"
```

## Boundaries

- Do not run polling or background automation in this manual workflow.
- Do not mutate unrelated Scout items.
- Do not delete Scout data, screenshots, recordings, production volumes, or user data.
- Do not use destructive Git or deploy commands unless explicitly requested and safe.
- Do not bypass repo safety rules, checks, or browser verification requirements.
