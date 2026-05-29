---
description: Audit finished Scout items
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Mode: audit completed Scout items.

Goal: audit completed Scout items with fresh evidence, identify weak or stale completion evidence, and repair or reopen anything that is not actually accepted.

Arguments: `$ARGUMENTS` is optional hint only: project, item id, date range, label, priority, or product area. Empty arguments mean use `SCOUT_PROJECT_SLUG` or available Scout context.

Use the skill as the source of truth for audit ledger, fresh evidence levels, browser/API safety, pass/fail/blocked classification, Russian QA notes, reopen/repair behavior, and final counts.

Flag `done` items whose latest evidence is local-only, stale, generic, cluster-only, route-sweep-only, or missing the original user journey. Reopen only confirmed failures or blocked/unconfirmable acceptance paths; otherwise add an audit note with the risk and leave status unchanged.

Final response: audited/pass/fail/blocked/reopened/fixed/new-items counts, item ids, ledger path, and blockers.
