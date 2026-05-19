---
description: Audit completed Scout items with fresh evidence
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Goal: audit completed Scout items for real acceptance, without implementing fixes unless the user explicitly expands the scope.

Input: `$ARGUMENTS` may contain a project slug/id, item ids, status scope, date range, label, priority, or audit focus. If empty, audit `done` items in the current Scout project context.

Required behavior:
1. Treat this as QA/audit mode, not delivery mode: do not edit code, commit, or deploy by default.
2. Build a durable ledger outside the repo before auditing. Record item id, status, URL/surface, role, scenario, evidence checked, result `pass`/`fail`/`blocked`, Scout action, and next step.
3. Use fresh evidence. Do not treat old Scout notes or old completion evidence as a pass by themselves.
4. For user-visible items, prefer browser evidence of the original acceptance path. For unsafe mutations, verify safe read paths and mark `blocked` when disposable fixtures/access are missing.
5. For failed or unconfirmable completed items, add a Russian QA note with expected/actual behavior, steps, URL, role, and console/network/API evidence, then reopen with `/api/items/reopen` to `in_progress` when appropriate.
6. If a separate new bug is found, create or recommend a separate Scout item instead of mixing it into the audited item.

Final response: audited/pass/fail/blocked/reopened/new-items counts, item ids, ledger path, and blockers.
