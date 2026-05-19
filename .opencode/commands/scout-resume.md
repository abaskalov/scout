---
description: Resume interrupted Scout work from live state
subtask: false
---

Load and follow the `scout-manual-workflow` skill.

Goal: resume interrupted Scout work safely without relying on stale chat memory.

Input: `$ARGUMENTS` may contain an item id, project slug/id, previous ledger path, artifact directory, branch/commit, or short description of the interrupted work.

Required behavior:
1. Reconstruct reality from live sources first: git status/branches/diffs, Scout queue counts, full item data, notes/evidence, running services, deploy state, and any ledger/artifact path in `$ARGUMENTS`.
2. Treat previous session summaries, compacted prompts, and temp artifacts as hints only until verified against live Scout/repo state.
3. Identify the active mode: one item, all open items, review queue, audit, or blocked recovery.
4. Continue with the matching Scout command behavior and the `scout-manual-workflow` status transition algorithm.
5. Do not duplicate notes, commits, deploys, or status transitions that already succeeded. Verify before repeating.
6. If state is inconsistent, record the inconsistency in Scout or the ledger, choose the safest next action, and ask only if a real product/destructive/access decision is required.

Final response: reconstructed state, resumed mode, actions completed, Scout updates, verification, and remaining blockers.
