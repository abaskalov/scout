---
description: Verify Scout review queue and close passing items
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Goal: verify Scout items in `review` on the accepted target environment and move passing items to `done`.

Input: `$ARGUMENTS` may contain a project slug/id, item ids, branch/commit/PR, deploy target, or phrase such as `deploy first`, `staging`, `production`, or `no deploy`.

Required behavior:
1. Discover the review queue from live Scout state. If `$ARGUMENTS` names specific items, limit scope to those items.
2. Fetch each full item with notes, evidence, branch/PR, related items, and acceptance hints before testing.
3. If deploy is requested or required, use only the repository's canonical deploy path and wait for health checks. Do not invent manual deploy fallbacks.
4. Verify item-specific acceptance on the target environment. Browser evidence is required for user-visible work when feasible.
5. For passing items, add structured target-environment evidence and a concise Russian completion note, then resolve to `done`.
6. For failing items, add a Russian failure note with repro evidence and move `review -> in_progress` with `/api/items/update-status`.
7. For blocked verification, keep the honest status and record the exact missing access/fixture/decision.

Final response: review items checked, moved to `done`, returned to `in_progress`, blocked, deploy/run evidence, and remaining queue counts.
