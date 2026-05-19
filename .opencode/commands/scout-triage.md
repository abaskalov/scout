---
description: Triage and cluster Scout queue without code changes
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Goal: inspect and prioritize Scout work without editing code, committing, deploying, or changing Scout statuses unless the user explicitly asks.

Input: `$ARGUMENTS` may contain a project slug/id, status scope, label, priority, release target, or product area. If empty, inspect open items in the current Scout project context.

Required behavior:
1. Discover Scout access from env/local ignored `.env` without printing secrets.
2. Fetch live queue data and representative full item details. Include `new`, `in_progress`, and `review` unless `$ARGUMENTS` narrows scope.
3. Cluster items by suspected root cause, product surface, risk, required role/fixture, and verification environment.
4. Identify duplicates, blockers, ambiguous product decisions, unsafe destructive checks, and items that appear already covered by existing commits/evidence.
5. Return an execution order optimized for impact and shared root causes.
6. Do not edit files or mutate Scout state in triage mode unless the user explicitly authorizes it in `$ARGUMENTS`.

Final response: queue counts, prioritized clusters, recommended next command (`/scout-one`, `/scout-all`, `/scout-review`, or `/scout-audit`), risks, and exact questions/blockers.
