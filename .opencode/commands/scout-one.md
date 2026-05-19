---
description: Solve one/next Scout item end-to-end
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Goal: handle exactly one Scout item end-to-end.

Input: `$ARGUMENTS` may contain a Scout item id, Scout item URL, search text, project slug/id, or a short scope hint. If `$ARGUMENTS` is empty, use `SCOUT_PROJECT_SLUG` or the available Scout project context and choose the best next actionable item.

Required behavior:
1. Discover Scout access from env/local ignored `.env` without printing secrets.
2. Fetch the full item before editing code: message, status, priority, labels, URL, screenshot/recording, notes, evidence, assignee, branch, PR/MR, related items, and permissions.
3. Claim or move to `in_progress` only when actually starting work.
4. Diagnose root cause, make the smallest correct change, and verify with fresh evidence matched to the changed surface.
5. For user-visible work, verify the reported acceptance path in a browser when feasible.
6. Commit focused code changes unless the item is analysis-only, blocked, already fixed, or the user explicitly forbids commits.
7. Add structured Scout evidence and a concise Russian Scout note.
8. Move the item through the `scout-manual-workflow` status transition algorithm: usually `review` after local verified commit, `done` only after accepted or target-environment verification.

Boundaries:
- Do not start a second unrelated Scout item.
- If related items share the same root cause, link/update them only when their own acceptance condition can be checked.
- Ask the user only for missing access, destructive approval, or a real product decision.
- If blocked, leave the item in the honest status and record the exact blocker in Scout.

Final response: item id/title, what changed, verification evidence, Scout status/evidence/note updates, commit/branch/PR if any, and any remaining blocker.
