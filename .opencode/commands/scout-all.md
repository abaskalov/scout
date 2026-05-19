---
description: Solve all actionable Scout items in scope
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Goal: process all actionable Scout items in scope until no eligible open work remains, or only real blockers remain.

Input: `$ARGUMENTS` may contain a Scout project slug/id, statuses, labels, priority, release/deploy target, or a narrowing phrase. If `$ARGUMENTS` is empty, use `SCOUT_PROJECT_SLUG` or the available Scout project context.

Required behavior:
1. Discover Scout access from env/local ignored `.env` without printing secrets.
2. Build the live queue from Scout, not stale notes: include `new`, `in_progress`, and `review` items unless `$ARGUMENTS` narrows the scope.
3. Create a resume-safe ledger outside the repo and update it after each item with item id, starting status, action, evidence, resulting status, commit/PR, blockers, and next step.
4. Work one item at a time. Use the `scout-one` lifecycle for `new`/`in_progress` implementation items and the `scout-review` lifecycle for items already in `review`.
5. Keep status semantics strict: local verified commits go to `review`; `done` requires accepted or target-environment verification evidence.
6. Deploy only through the repository's canonical deploy path and only when the repo/user workflow allows it. If deploy is not allowed or not requested, leave locally completed work in `review` with evidence.
7. For browser/user-visible work, verify acceptance paths in a browser. For backend/data work, include targeted API/DB/read-model evidence where relevant.
8. Stop only for missing access, destructive approval, or product decisions that cannot be inferred safely. Record each blocker in Scout before moving on.

Final response: starting counts, final counts, items completed/reviewed/blocked/cancelled, commits/PRs/deploys, ledger path, verification summary, and exact remaining blockers if any.
