---
description: Finish all actionable Scout items
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Mode: batch all actionable Scout items.

Goal: systemically process all actionable Scout items in scope until each is `done`, honestly blocked, or waiting in `review`/`testing` only because target-environment verification is unavailable, not allowed, or still underway.

Arguments: `$ARGUMENTS` is optional scope only: project, label, priority, release target, item set, or other narrowing hint. Empty arguments mean use `SCOUT_PROJECT_SLUG` or available Scout context.

Use the skill as the source of truth for queue discovery, durable ledger, clustering, status gates, commits, deploy/target verification, structured evidence, Russian Scout notes, and blockers.

This command explicitly allows focused local commits required for Scout handoff. Do not push or deploy unless the repository workflow or user request explicitly allows it.

Do not claim the whole queue at once. Claim only the active item or evidence-backed shared-root cluster, and before any batch status updates prepare a per-item readiness matrix: item id, original acceptance, evidence level, coverage, result, unchecked risks, and next honest status.

Final response: starting counts, final counts, items completed/reviewed/testing/blocked/cancelled, commits/PRs/deploys, ledger path, verification summary, and exact remaining blockers if any.
