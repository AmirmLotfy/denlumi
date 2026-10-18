# Start here in Codex

Build Denlumi from this pack. Begin with Phase 0 only.

Read AGENTS.md and docs 01, 03, 05, 07, 12. Inspect the logical data model, then create the smallest testable slice. Do not create a full screen inventory before proving state transitions.

The target is a responsive consumer web app with a real database and authenticated HTTP MCP backend behind a plainly disclosed Alexa-style browser simulation. No physical Amazon device is available. The product covers all three pairings plus single-pet and multi-pet coordination.

## Phase 0 deliverables
- Repository and immutable dependency lockfile using verified current official packages.
- Authentication test and household-scoped read route.
- Actual MCP initialize/tools-list/tool-call traces against the required selected protocol version.
- Real Bedrock request in an accessible region; record the model capability result and cost guard.
- Speech input/output feasibility with typed fallback. A failed voice provider is a blocker, not simulated success.
- Migration plan, RLS test plan, and protocol demo/live isolation design.
- One fictional case that can be loaded, paused, and read from a fresh session.
- A small TASKS.md with next tasks, not an enormous autonomous build loop.

Do not buy domains, accept legal terms, impersonate a reviewer, publish private data, deploy customer-facing practical animal guidance, or submit the competition without explicit authorization where required. Denlumi's proposed domain is not known to be owned.

## First full vertical slice after Phase 0
Fictional cat-dog household -> reviewed-in-demo plan state -> session start -> confirmed observation -> pause transaction -> stale caregiver refusal -> new-conversation retrieval -> private summary preview. Then run the identical software contract against distinct cat-cat and dog-dog fixtures.

Return evidence, not claims: logs with secrets removed, tests actually run, observable state before/after, and clear unresolved dependencies.
