---
description: Finish Scout items waiting in review or testing
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Mode: finish items in `review` or `testing`.

Goal: verify Scout items that are already in `review` or `testing` against their accepted target environment, close only passing items to `done`, and fix or return failing or weak-evidence items to `in_progress` with evidence.

Arguments: `$ARGUMENTS` is optional hint only: project, item id, deploy target, branch, commit, PR, or scope. Empty arguments mean use `SCOUT_PROJECT_SLUG` or available Scout context.

Use the skill as the source of truth for live queue discovery, canonical deploy path, target-environment verification, failure handling, structured evidence, Russian Scout notes, and status transitions.

This command explicitly allows focused local commits required to repair failed review/testing items. Do not push or deploy unless the repository workflow or user request explicitly allows it.

Do not move items to `done` from aggregated smoke, route sweep, or cluster-only evidence. For every item, compare the original acceptance/evidence with the current target result and record `result`, `level`, `coverage`, and unchecked risks.

Final response: review/testing items checked, moved to `done`, fixed and returned to review/testing/done, blocked, deploy/run evidence, and remaining queue counts.
