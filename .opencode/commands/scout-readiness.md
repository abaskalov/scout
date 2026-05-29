---
description: Audit Scout queue readiness without changing code
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Mode: readiness audit only.

Goal: inspect Scout items in scope and produce a per-item readiness matrix without implementing code, changing workflow statuses, or adding broad notes unless a blocker must be recorded.

Arguments: `$ARGUMENTS` is optional hint only: project, item id, status set, label, priority, branch, release target, or product area. Empty arguments mean use `SCOUT_PROJECT_SLUG` or available Scout context.

Use the skill as the source of truth for queue discovery, related-item checks, evidence quality, status gates, target-environment requirements, and blocker classification.

Required matrix columns: item id/title, current status, item type, suspected cluster/root cause, original acceptance path, latest evidence level, coverage, result, missing evidence or commit/deploy reference, next honest status, and recommended next action.

Boundaries:
- Do not claim items.
- Do not edit repository files.
- Do not move statuses.
- Do not close items.

Final response: readiness counts, matrix summary, highest-risk weak-evidence items, recommended next batch order, and exact blockers.
