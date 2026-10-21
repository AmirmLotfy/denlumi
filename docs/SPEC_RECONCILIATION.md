# Denlumi specification reconciliation

Planning record: 2026-09-16. Scope: reconcile the complete project while authorizing implementation of **Phase 0 only**. This file is a decision aid, not proof of an integration, software test, customer result or professional content approval.

## Inputs and authority

1. Current explicit user instructions and root AGENTS.md (operator instructions omitted from this public snapshot), including the current phase/stop boundary.
2. Build pack AGENTS.md (operator instructions omitted from this public snapshot), [START_HERE_CODEX.md](../Denlumi_Build_Pack_v1/START_HERE_CODEX.md), detailed docs 01–12, contracts, fixtures and QA definitions.
3. [MASTER_BLUEPRINT.md](../Denlumi_Build_Pack_v1/MASTER_BLUEPRINT.md), which collects the product and technical specification.
4. Supplied full-blueprint text: `<local-home>/.codex/attachments/00f0b05f-a4e7-473d-b139-d24e600b5645/pasted-text.txt` (sections 01–12 and Codex start instructions).
5. Supplied narrative overview: `<local-home>/.codex/attachments/ba59f744-6043-414b-ad45-d7bca7274367/pasted-text.txt` (product overview, compressed seven-stage build sequence and starter prompt).

The detailed pack controls phase names and precise contracts where the narrative is compressed. No source can manufacture reviewer approval, credentials, account eligibility, successful calls or permission for later phases. Current official documentation and actual account behavior still need verification during the authorized technical work; source links in a specification are not that verification.

## Resolved differences and implementation consequences

| Topic | Source tension | Selected interpretation |
|---|---|---|
| Phase numbering | Pack doc 10 uses Phase 0–10; narrative section 14 uses seven stages numbered 1–7. | Use pack Phase 0–10. The narrative feasibility stage 1 maps to Phase 0; it is not permission to start pack Phase 1. Mapping appears below. |
| `P0` acceptance labels | Every QA definition is labeled `(P0)`, including future routines, notifications, sharing and commerce. | `acceptance-tests.json` defines `priority: "P0"`. This is priority, not delivery phase. Allocate tests to the roadmap's actual feature phases; do not implement the full product under Phase 0. |
| P0 proof versus full vertical slice | START_HERE places the full review/session/handover/summary slice after Phase 0; the narrative starter requests observation→pause, stale-caregiver rejection and fresh-conversation retrieval while also saying Phase 0 only. | Implement only the smallest fictional feasibility probe necessary to demonstrate load/pause/fresh read, state freshness and local stop. Reuse the intended state/auth contracts. Generalized plan authoring, session UX, routines, summaries and full coverage stay in their later phases. Record any unproved part explicitly. |
| Real MCP versus hackathon alternative | Doc 05 says the simulated Alexa path itself does not require MCP; project rules and starter explicitly require actual HTTP MCP. | Real authenticated Streamable HTTP MCP is a project requirement. Bedrock tool JSON, in-process calls or tool animations cannot stand in for the HTTP exchange. |
| MCP protocol version | Source S12 references `2025-11-25`; doc 05 says select and lock the actual supported combination in Phase 0. | Use `2025-11-25` as the supplied specification baseline, verify the required endpoint/client compatibility against official documentation, record the selected protocol version and actual negotiation/initialize/tools-list/tool-call traces. Do not silently substitute a version or claim compatibility from the reference alone. Native Alexa requirements remain a separate future gate. |
| Optional voice versus speech gate | Architecture calls Polly output optional and typed mode always available; P0 requires speech input/output feasibility. | P0 records actual speech capability or a concrete blocker. Typed controls are complete regardless. A fallback does not count as a successful Transcribe/Polly call. Full voice interaction belongs to Phase 6. |
| All pairings in the first release | Brief/narrative require all three pairings; P0 requires one fictional case. | One probe is enough for the bounded P0 milestone, provided schema/contracts preserve all pairings. R0 release remains incomplete until distinct cat-cat, dog-dog and mixed flows pass; both mixed newcomer contexts are retained. |
| Single-pet and multi-pet views | Active-session layout describes two named pet controls; the product supports one pet and 3+ pets. | Render selected participants, not a hard-coded pair. Single-pet cases have no fabricated second pet. Multi-pet records keep separate pair contexts; no inferred group readiness. One unresolved guided session per household applies to all cases. |
| Reviewed-in-demo state | START_HERE uses “reviewed-in-demo”; protocols contain `demo_only` and no qualified approval. | A fictional owner review can exercise plan-version gates. It must never create a real expert approval or relabel a `demo_only` protocol `approved`. Live households reject the fixture. |
| Broad scenario coverage | Overview lists all scenarios; doc 03 limits guidance/release per scenario, including SC17 in R1. | R0 can route, record and coordinate without practical guidance. SC17 gets history/archive schema foundations but its dedicated sensitive coordination workflow is R1. “Coverage” is not a claim to treat every animal problem. |
| Frontend fonts | Doc 04 recommends licensed self-hosted fonts; AGENTS forbids font files in public artifacts. | Use a system-font fallback for P0 and exclude font binaries from public artifacts. Verify licensing/distribution constraints before any later typography decision; no font redistribution is presumed authorized. |
| Summary/share integration | PRD requires private R0 text/HTML export; architecture/API describe sharing and S3/worker services. | Private preview/export precedes external sharing. Do not infer a professional portal, PDF provider or automatic send. Each real share needs exact authenticated owner authorization and scope/expiry/revocation checks. |
| Logical model versus implementation | Pack describes 37 entities and 75 test definitions and includes a validation report. | These are design inputs. Generate only migrations needed for the current bounded slice; preserve the full migration plan. Pack consistency validation is distinct from executed application, permission, provider and browser tests. |
| Commercial offer | Marketing proposes a $29/90-day pass; PRD says no real R0 checkout. | Treat price, quotas, conversion targets and margin as hypotheses. Billing and entitlements are conditional R1 work after provider/business eligibility, reviewed pilot and explicit authority. No paywall on pause/help/relevant records/export. |
| Brand and public launch | Name is selected; domain and trademark are unverified; doc 10 describes public submission assets. | Denlumi is the working name. No domain purchase, trademark-clearance assertion, public deployment, video publication or submission follows from roadmap preparation or P0 implementation. |
| Rules/deadline/source freshness | Evidence register states sources were checked on 2026-09-16. | Preserve provenance as supplied evidence, not a fresh verification. Recheck official rules/access/docs at the applicable gate and record actual results. |

## Selected architecture and protocol contract

The selected stack is unchanged from [doc 05](../Denlumi_Build_Pack_v1/docs/05_architecture_and_integrations.md): Next.js App Router + TypeScript; Vercel web hosting; Supabase PostgreSQL/authentication with RLS plus server authorization; private S3 objects; Amazon Bedrock Converse; Transcribe input and optional Polly output; SQS/Lambda jobs and EventBridge dispatch; internal inbox first, SES only if explicitly configured for authorized email. One monorepo contains one web app, domain/contracts/content packages, workers and infrastructure. Selection does not imply deployment or access.

P0 chooses and locks exact package versions from current official documentation and records the working region/model/API combination. No stack substitution is implicit if a credential or provider gate fails. A failure should remain visible while independent local work continues within scope.

The assistant must execute authenticated Streamable HTTP MCP through the actual endpoint. Required feasibility evidence includes `initialize`, negotiated/selected version, `tools/list` and at least one `tools/call`. The later orchestrator discovers allowed tools, maps their schemas into Bedrock's tool interface, executes actual HTTP calls and returns validated results. Native Alexa access, OAuth 2.1/PKCE account linking, certification and live-device behavior are unimplemented future gates, not properties of the browser demo.

Nine intended tools remain: `get_household_brief`, `get_case_context`, `list_due_tasks`, `prepare_session`, `record_observation`, `pause_guidance`, `draft_handover`, `draft_professional_summary`, `explain_current_step`. P0 may expose only the subset needed for the probe; the future whitelist never includes arbitrary HTTP, progression approval, hold clearing, invitations, external sending, medication changes or physical controls.

The persisted safety update remains one transaction: lock household → append the appropriately confirmed event → update hold → increment `safety_epoch` → stale dependent reviews → interrupt affected session → cancel dependent future tasks → write handover/outbox/audit → commit. The device can stop locally before this transaction succeeds; household synchronization cannot be announced before commit. Exact draft confirmation comes from authenticated human input, not a model-controlled boolean.

## Narrative-to-canonical phase mapping

| Narrative overview stage | Canonical build-pack phases |
|---|---|
| 1. Feasibility | 0 |
| 2. Household state | 1–2 |
| 3. Core workflow | 3–4, with later conversation integration in 6 |
| 4. Coordination | 5 and 7 |
| 5. Pairing coverage | Foundations in 1–4; complete coverage and UX in 8 |
| 6. Validation | Content review in 8, hardening in 9; relevant tests begin with each feature |
| 7. Submission | 10; public actions remain separately gated |

## Required evidence language

Use `planned`, `implemented`, `locally tested`, `real HTTP verified`, `live provider verified`, `hosted verified`, `human reviewed`, `BLOCKED` and `not run` only when the underlying evidence supports the precise label. Do not combine them into a generic “passed” or “production-ready.” A successful shape/schema test does not establish animal welfare, and reviewed source material does not approve newly written practical instructions.

**Stop after Phase 0 evidence and handoff.** This reconciliation and [ROADMAP.md](ROADMAP.md) preserve the later project scope without authorizing its implementation.
