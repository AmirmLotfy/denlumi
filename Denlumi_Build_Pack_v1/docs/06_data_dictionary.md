# 06 - Logical ERD and data dictionary

This model defines 37 logical entities for the complete product, including small junction and operational tables. It is one relational application, not one service per entity. Most are R0; entitlements are R1. This is not executable SQL. Generate migrations, indexes, constraints, policies and tests from this model before connecting customer data.

## Global invariants
All IDs are UUIDs; timestamps use timestamptz/UTC with household IANA timezone. Tenant-owned tables use a household boundary. Optional fields marked `?` can be null. Cross-table references require same-household validation; simply adding household_id without a composite constraint is insufficient. JSON fields use versioned schemas and are not a place to hide authority or mutable clinical instructions.

Use ON DELETE RESTRICT for shared historical dependencies unless the explicit deletion workflow removes the scope coherently. No silent cascading deletion of another caregiver's historical report. Soft archive is distinct from a legally required deletion. Every foreign key needs a deliberate index strategy. RLS checks and server authorization complement one another.

Core indexes: memberships(profile_id,household_id,expires_at,revoked_at); pets(household_id); cases(household_id,status); sessions(household_id,state); observations(household_id,case_id,reported_at DESC); safety_holds(household_id,state); handovers(household_id,safety_epoch); task_occurrences(household_id,state,due_at); outbox_events(state,not_before); assets(household_id,state).

Critical constraints: canonical unique pairs; at least one case/session pet; one unresolved guided session per household; one active owner; exact-payload single-use authorization; unique occurrence/effect keys; immutable reviewed protocol/plan versions; confirmed observations have verified attribution. Database state must enforce these, not just UI controls.

## Entities

### profiles (R0)
Human identity without implicit household access. Global/identity data with separate access rules.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `auth_subject` | `text` | Unique verified auth subject |
| `display_name` | `text` | Chosen name |
| `status` | `enum` | active/disabled |
| `reviewer_scope` | `jsonb?` | Verified content-review scopes; not self-asserted |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(auth_subject). Never infer membership from an email domain.

### households (R0)
Root scope and monotonic safety state. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `owner_id` | `uuid` | Sole plan decision owner; references `profiles` |
| `nickname` | `text` | Private home name |
| `mode` | `enum` | demo/live; server-administered |
| `timezone` | `text` | IANA timezone |
| `locale` | `text` | Approved-content locale |
| `home_version` | `bigint` | Increments on relevant layout edits |
| `safety_epoch` | `bigint` | Monotonic invalidation sequence |
| `status` | `enum` | active/suspended/deleting |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Epoch/version nonnegative; mode cannot be changed by a client.

### memberships (R0)
Adult household roles and temporary access. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `profile_id` | `uuid` | Member; references `profiles` |
| `role` | `enum` | owner/caregiver/sitter/reader |
| `pet_scope` | `uuid[]?` | Explicit pets; validate same household |
| `case_scope` | `uuid[]?` | Explicit cases; validate same household |
| `expires_at` | `timestamptz?` | Required for sitter |
| `revoked_at` | `timestamptz?` | Effective immediately |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: One active owner; partial unique active household/profile. Scoped arrays require validated membership.

### pets (R0)
Pet identity and owner-reported characteristics. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `nickname` | `text` | Name; not necessarily unique |
| `species` | `enum` | cat/dog |
| `age_band` | `text?` | Unknown allowed |
| `approx_birth_date` | `date?` | Optional |
| `arrival_date` | `date?` | Owner reported |
| `context_notes` | `jsonb` | Minimal relevant reported history |
| `archived_at` | `timestamptz?` | Soft archive preserving history |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: No compatibility, diagnosis, or happiness-score fields.

### home_zones (R0)
Versioned human-planned space. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `label` | `text` | Kitchen, quiet room, etc. |
| `home_version` | `bigint` | Version this record belongs to |
| `arrangement_note` | `text?` | Plan, not sensor evidence |
| `reported_by` | `uuid?` | Last human reporting arrangement; references `profiles` |
| `reported_at` | `timestamptz?` | No report remains unknown |
| `created_at` | `timestamptz` | Server timestamp |

### resources (R0)
Named care/retreat resources in a zone. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `zone_id` | `uuid` | Same household zone; references `home_zones` |
| `kind` | `enum` | water/food/litter/rest/retreat/enrichment/barrier/other |
| `label` | `text` | Human description |
| `status` | `enum` | planned/reported_present/unknown/removed |
| `created_at` | `timestamptz` | Server timestamp |

### pet_resource_access (R0)
Planned per-pet access. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `pet_id` | `uuid` | Pet; references `pets` |
| `resource_id` | `uuid` | Resource; references `resources` |
| `access_plan` | `enum` | exclusive/shared/separate_times/unknown |
| `version` | `bigint` | Versioned assignment |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Same-household composite references; plan is not proof of actual access.

### pet_pairs (R0)
Canonical unordered pair. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `pet_a_id` | `uuid` | Canonical lower UUID; references `pets` |
| `pet_b_id` | `uuid` | Canonical higher UUID; references `pets` |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: pet_a_id < pet_b_id; UNIQUE(household_id,pet_a_id,pet_b_id); no species field that can drift from pets.

### cases (R0)
Situation record and product support route. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `scenario_code` | `text` | SC01-SC17 or later registered scenario |
| `title` | `text` | Owner-friendly name |
| `support_level` | `enum` | guided_preparation/coordination_only/clarification_required/professional_required/urgent_help |
| `intake` | `jsonb` | Versioned confirmed/unknown intake responses |
| `intake_schema_version` | `text` | Rule schema used |
| `status` | `enum` | draft/active/paused/archived |
| `created_at` | `timestamptz` | Server timestamp |

### case_pets (R0)
Single or multi-pet case membership. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid` | Case; references `cases` |
| `pet_id` | `uuid` | Pet; references `pets` |
| `role` | `enum` | resident/newcomer/returning/affected |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(household_id,case_id,pet_id); single-pet cases valid.

### pair_contexts (R0)
Pair outcome within a specific case/context. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid` | Case; references `cases` |
| `pair_id` | `uuid` | Pair; references `pet_pairs` |
| `context_key` | `text` | Home/room/outing context |
| `status` | `enum` | unreviewed/in_progress/paused/management_plan |
| `last_observation_at` | `timestamptz?` | Unknown allowed |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Pair pets must be case participants; context-specific status never implies group compatibility.

### protocols (R0)
Global content identity. Global/identity data with separate access rules.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `slug` | `text` | Stable original-content key |
| `scenario_family` | `text` | Introduction, settling, coordination |
| `pairing` | `enum` | cat_cat/dog_dog/cat_dog/single_cat/single_dog/coordination |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(slug). Source material licensing reviewed.

### protocol_versions (R0)
Immutable authored version with lifecycle gate. Global/identity data with separate access rules.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `protocol_id` | `uuid` | Parent protocol; references `protocols` |
| `version` | `text` | Semantic content version |
| `locale` | `text` | Reviewed locale |
| `status` | `enum` | draft/in_review/approved/demo_only/revoked/expired |
| `content` | `jsonb` | Original structured module |
| `digest` | `text` | SHA-256 content digest |
| `review_due_at` | `timestamptz?` | Required for approved content |
| `revoked_at` | `timestamptz?` | Instant suppression of further guidance |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(protocol_id,version,locale). Approved requires attributable review of exact digest.

### protocol_reviews (R0)
Scoped human expert approval record. Global/identity data with separate access rules.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `protocol_version_id` | `uuid` | Exact version; references `protocol_versions` |
| `reviewer_id` | `uuid` | Verified relevant reviewer; references `profiles` |
| `reviewed_digest` | `text` | Must equal approved version digest |
| `decision` | `enum` | changes_requested/approved/rejected |
| `scope_note` | `text` | Limits of review |
| `evidence_ref` | `text` | Private credential/review evidence pointer |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Reviewer credentials/scope verified outside model; no demo fixture asserts approval.

### source_references (R0)
Attribution for original reviewed content. Global/identity data with separate access rules.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `source_key` | `text` | S1 etc. |
| `title` | `text` | Source title |
| `url` | `text` | Public source URL |
| `checked_at` | `date` | Review date |
| `license_note` | `text` | What may be stored/reused |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: No full copied guides without license.

### protocol_sources (R0)
Version-to-source association. Global/identity data with separate access rules.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `protocol_version_id` | `uuid` | Content version; references `protocol_versions` |
| `source_id` | `uuid` | Attribution; references `source_references` |
| `use_note` | `text` | Specific source relevance |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(protocol_version_id,source_id).

### plan_revisions (R0)
Exact proposed/current case plan. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid` | Case; references `cases` |
| `protocol_version_id` | `uuid` | Applicable content; references `protocol_versions` |
| `revision_number` | `integer` | Case-local increasing number |
| `home_version` | `bigint` | Bound home state |
| `safety_epoch` | `bigint` | Bound safety state |
| `participant_digest` | `text` | Exact selected pets and roles |
| `status` | `enum` | draft/reviewed/active/paused/stale/superseded |
| `digest` | `text` | Exact plan hash |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(household_id,case_id,revision_number). No in-place edits of reviewed revisions.

### plan_steps (R0)
Ordered allowed steps from the applicable protocol. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `plan_revision_id` | `uuid` | Plan; references `plan_revisions` |
| `step_key` | `text` | Stable authored step identifier |
| `sequence` | `integer` | UI ordering only |
| `status` | `enum` | locked/available/in_progress/review_needed/completed/canceled |
| `prerequisite_snapshot` | `jsonb` | Explicit current/unknown prerequisites |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Ordering does not authorize progression; UNIQUE(plan_revision_id,step_key).

### plan_reviews (R0)
Owner acknowledgment of exact plan state. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `plan_revision_id` | `uuid` | Plan; references `plan_revisions` |
| `reviewer_id` | `uuid` | Owner; references `profiles` |
| `reviewed_digest` | `text` | Exact reviewed plan |
| `safety_epoch` | `bigint` | Epoch at review |
| `expires_at` | `timestamptz?` | Optional protocol-bounded freshness |
| `invalidated_at` | `timestamptz?` | Set when dependencies change |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Only household owner; not a clinical clearance.

### sessions (R0)
One real or fictional guided software session. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid` | Case; references `cases` |
| `plan_revision_id` | `uuid` | Exact plan; references `plan_revisions` |
| `started_by` | `uuid` | Authorized adult; references `profiles` |
| `state` | `enum` | preflight/active/paused/interrupted/finished/canceled |
| `safety_epoch` | `bigint` | Bound current epoch |
| `last_checkpoint_at` | `timestamptz?` | Last verified app interaction |
| `ended_at` | `timestamptz?` | End record |
| `idempotency_key` | `text` | Request uniqueness |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: One unresolved active/paused/interrupted session per household. Interrupted requires fresh checkpoint, not automatic release.

### session_pets (R0)
Actual session participants. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `session_id` | `uuid` | Session; references `sessions` |
| `pet_id` | `uuid` | Same-household case participant; references `pets` |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(session_id,pet_id); at least one participant; must be in plan participant digest.

### observations (R0)
Attributed reports, never unmarked objective truth. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid` | Case; references `cases` |
| `session_id` | `uuid?` | Optional session; references `sessions` |
| `actor_pet_id` | `uuid?` | Confirmed when report unambiguous; references `pets` |
| `target_pet_id` | `uuid?` | Optional other pet; references `pets` |
| `reporter_id` | `uuid` | Verified reporting person; references `profiles` |
| `raw_report` | `text` | Private exact report |
| `behavior_code` | `text?` | Versioned reviewed lexicon |
| `assertion` | `enum` | affirmed/negated/uncertain |
| `status` | `enum` | draft/confirmed/corrected |
| `source_kind` | `enum` | typed/voice/structured/professional_note |
| `observed_at` | `timestamptz?` | May be unknown |
| `reported_at` | `timestamptz` | Actual reporting time |
| `supersedes_id` | `uuid?` | Append-only correction; references `observations` |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: No pet IDs outside case/household; no inferred observed_at=reported_at by default.

### safety_holds (R0)
Software guidance restrictions with scope. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid?` | Affected case; references `cases` |
| `pet_id` | `uuid?` | Affected pet; references `pets` |
| `pair_id` | `uuid?` | Affected pair; references `pet_pairs` |
| `origin_observation_id` | `uuid?` | Evidence; references `observations` |
| `policy_level` | `enum` | clarification/professional/urgent |
| `reason_code` | `text` | Reviewed policy rule |
| `state` | `enum` | active/resolved |
| `created_epoch` | `bigint` | Household epoch at creation |
| `resolution_note` | `text?` | Attributable policy review, never automatic |
| `resolved_by` | `uuid?` | Verified authorized actor; references `profiles` |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Scope explicit; owner cannot clear professional/urgent holds. No duration-based auto-resolution.

### handovers (R0)
Versioned household/case change summary. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid?` | Optional case; references `cases` |
| `safety_epoch` | `bigint` | State summarized |
| `body` | `jsonb` | Factual original-content summary |
| `status` | `enum` | draft/published/superseded |
| `digest` | `text` | Exact published summary |
| `created_at` | `timestamptz` | Server timestamp |

### handover_acks (R0)
Read acknowledgment of exact update. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `handover_id` | `uuid` | Update; references `handovers` |
| `profile_id` | `uuid` | Reader; references `profiles` |
| `acknowledged_digest` | `text` | Exact content |
| `acknowledged_at` | `timestamptz` | Acknowledged time |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(handover_id,profile_id,acknowledged_digest); reading does not establish physical action.

### routine_rules (R0)
Owner-entered recurring care task. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `pet_id` | `uuid` | Pet; references `pets` |
| `created_by` | `uuid` | Owner; references `profiles` |
| `kind` | `enum` | meal/water/walk/litter/rest/enrichment/other_nonmedical |
| `instruction` | `text` | Owner instructions, not AI prescription |
| `schedule_spec` | `jsonb` | IANA timezone and recurrence |
| `status` | `enum` | active/paused/archived |
| `version` | `integer` | Schedule version |
| `created_at` | `timestamptz` | Server timestamp |

### task_occurrences (R0)
Materialized routine/plan task. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `routine_rule_id` | `uuid?` | Routine parent; references `routine_rules` |
| `plan_step_id` | `uuid?` | Plan task parent; references `plan_steps` |
| `assigned_to` | `uuid?` | Authorized caregiver; references `profiles` |
| `due_at` | `timestamptz` | Planned time |
| `expected_safety_epoch` | `bigint?` | Required for plan-dependent tasks |
| `state` | `enum` | planned/claimed/reported_done/skipped/uncertain/canceled |
| `occurrence_key` | `text` | Deterministic recurrence key |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Exactly one parent; unique parent+occurrence_key; future plan reminders revalidate epoch.

### task_reports (R0)
Independent attributed care reports. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `task_occurrence_id` | `uuid` | Task; references `task_occurrences` |
| `reporter_id` | `uuid` | Person; references `profiles` |
| `report` | `enum` | done/skipped/uncertain/correction |
| `performed_at` | `timestamptz?` | Reported action time |
| `note` | `text?` | Minimal context |
| `supersedes_id` | `uuid?` | Correction; references `task_reports` |
| `idempotency_key` | `text` | Duplicate submission protection |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Multiple independent reports preserved; no inferred ingestion or action from a notification.

### professional_summaries (R0)
Private prepared report, not diagnosis. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid` | Case; references `cases` |
| `body` | `jsonb` | Reports, unknowns, current plan |
| `source_event_ids` | `uuid[]` | Validated same-household provenance |
| `digest` | `text` | Exact preview content |
| `status` | `enum` | draft/reviewed/shared/superseded |
| `created_by` | `uuid` | Owner/requestor; references `profiles` |
| `created_at` | `timestamptz` | Server timestamp |

### action_authorizations (R0)
Single-use approval for external/consequential actions. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `owner_id` | `uuid` | Authorizing owner; references `profiles` |
| `action_kind` | `enum` | share/invite/export/plan_review |
| `payload_digest` | `text` | Exact content and destination |
| `expires_at` | `timestamptz` | Short authorization lifetime |
| `consumed_at` | `timestamptz?` | Once only |
| `idempotency_key` | `text` | Request de-duplication |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: No arbitrary action from an LLM; changing recipient/content invalidates authorization.

### share_grants (R0)
Scoped expiring external access. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `summary_id` | `uuid?` | Shared summary; references `professional_summaries` |
| `authorization_id` | `uuid` | Exact approved action; references `action_authorizations` |
| `recipient_address` | `text` | Private verified intended address |
| `token_hash` | `text` | Store hash, not reusable plaintext secret |
| `scope` | `jsonb` | Exact records/pets |
| `expires_at` | `timestamptz` | Expiry |
| `revoked_at` | `timestamptz?` | Immediate revocation |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Raw token never in analytics; verified recipient does not prove professional qualification.

### outbox_events (R0)
Transactional side-effect requests. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `event_type` | `text` | Whitelisted event |
| `payload` | `jsonb` | Minimal IDs; private body elsewhere |
| `expected_safety_epoch` | `bigint?` | Freshness gate |
| `idempotency_key` | `text` | Unique effect key |
| `state` | `enum` | pending/processing/done/canceled/failed/uncertain |
| `not_before` | `timestamptz?` | Schedule |
| `expires_at` | `timestamptz?` | Stale event deadline |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: UNIQUE(household_id,idempotency_key); same transaction as domain event.

### deliveries (R0)
Delivery attempts separated from acknowledgment. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `outbox_event_id` | `uuid` | Origin; references `outbox_events` |
| `channel` | `enum` | internal/email |
| `provider_message_id` | `text?` | Provider result |
| `attempt` | `integer` | Retry number |
| `status` | `enum` | queued/provider_accepted/delivered/failed/uncertain/canceled |
| `last_error_code` | `text?` | No sensitive payload in error |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: No delivered claim solely from queue success.

### audit_events (R0)
Minimal append-only application audit. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `actor_id` | `uuid?` | User or named service; references `profiles` |
| `event_type` | `text` | Domain event |
| `entity_type` | `text` | Whitelisted table/entity |
| `entity_id` | `uuid` | Same-household record |
| `safety_epoch` | `bigint` | Relevant state |
| `metadata` | `jsonb` | Minimal IDs/hashes, not raw voice content |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Append-only to normal application roles; deletion follows explicit privacy policy.

### ai_runs (R0)
Operational agent provenance. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `case_id` | `uuid?` | Scoped case; references `cases` |
| `model_id` | `text` | Actually used model |
| `prompt_version` | `text` | Instruction version |
| `protocol_version_id` | `uuid?` | Relevant content; references `protocol_versions` |
| `tool_names` | `text[]` | Actual allowed calls |
| `outcome` | `enum` | completed/clarified/blocked/failed |
| `usage` | `jsonb` | Token/audio totals; no raw prompts by default |
| `created_at` | `timestamptz` | Server timestamp |

### assets (R0)
Private objects and generated exports. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `owner_id` | `uuid` | Uploader/requestor; references `profiles` |
| `kind` | `enum` | pet_image/private_document/export |
| `object_key` | `text` | Private S3 key |
| `mime_type` | `text` | Allowlisted MIME |
| `digest` | `text` | Byte digest |
| `state` | `enum` | uploading/quarantined/ready/deleting/deleted |
| `expires_at` | `timestamptz?` | Optional retention |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: Object access derives from application scope, not a guessable path.

### entitlements (R1)
Future paid capabilities, independent of safety/access roles. Household-scoped.

| Field | Type | Meaning |
|---|---|---|
| `id` | `uuid` | Primary key |
| `household_id` | `uuid` | Tenant boundary; references `households` |
| `provider_reference` | `text` | Verified billing event reference |
| `plan_key` | `text` | Household pass |
| `starts_at` | `timestamptz` | Access start |
| `ends_at` | `timestamptz` | Access expiry |
| `status` | `enum` | active/expired/refunded/revoked |
| `created_at` | `timestamptz` | Server timestamp |

Constraints: No live R0 payment. Safety and export remain outside quota.
