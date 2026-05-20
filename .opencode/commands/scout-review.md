---
description: Finish Scout items waiting in review or testing
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Goal: finish Scout items that are already in `review` or `testing`: verify the accepted target environment, close passing items to `done`, and fix or return failing items to `in_progress` with evidence.

No arguments are required. If `$ARGUMENTS` is present, treat it only as a hint such as a project, item id, deploy target, branch, commit, or PR.

Required behavior:
1. Discover the `review` and `testing` queues from live Scout state. If the user named specific items, limit scope to those items.
2. Fetch each full item with notes, evidence, branch/PR, related items, and acceptance hints before testing.
3. If deploy is needed, use only the repository's canonical deploy path and wait for required health checks. Do not invent manual deploy fallbacks.
4. Verify item-specific acceptance on the target environment. Browser evidence is required for user-visible work when feasible.
5. For passing items, add structured target-environment evidence and a concise Russian completion note, then resolve to `done`.
6. For failing items, add a Russian failure note with repro evidence, move `review`/`testing` -> `in_progress`, and fix end-to-end when safe in the current repo.
7. For blocked verification, keep the honest status and record the exact missing access/fixture/decision.

Final response: review/testing items checked, moved to `done`, fixed and returned to review/testing/done, blocked, deploy/run evidence, and remaining queue counts.
