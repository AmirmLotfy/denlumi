# 02 - Product requirements document

## Product surfaces
A responsive web app with installable-shell support, a public marketing website, a browser voice/text simulation, a scoped caregiver invitation flow, and a restricted protocol-review/admin console. Native iOS/Android apps are not R0 requirements. A browser app is not equivalent to a continuously running background monitor.

## Roles
| Role | Allowed | Not allowed |
|---|---|---|
| Owner | Manage household, approve plan revisions, invite/revoke caregivers, approve external shares | Override professional-only gates, forge professional approval |
| Caregiver | Read assigned pets/plans, acknowledge updates, run authorized sessions, record observations, pause | Change permissions, approve a harder step, export all records |
| Temporary sitter | Same functions within named pets and an expiring time window | Read unrelated cases, invite others, outlive grant |
| Read-only collaborator | Read explicitly shared records | Run sessions or write reports |
| Verified content reviewer | Review original educational protocol versions in assigned expertise | Browse customer households by default |
| Support operator | Inspect minimal operational metadata | Open private notes without separately authorized support access |

A real professional's access to a specific customer case is separately consented. A content reviewer is not automatically the household's clinician.

## Functional requirements
### FR-01: Create a household
Collect household nickname, time zone, locale, adult-owner acknowledgment, and notification preferences. Do not require street address, GPS, income, diagnoses, or unrelated account access. Offer a fictional sample before signup. Ownership changes require an explicit authenticated transfer.

### FR-02: Add pets
Fields: nickname, cat/dog species, optional age or approximate age band, arrival date, resident/newcomer role per case, relevant owner-reported history, optional photograph, and accessibility accommodations. Unknown remains unknown. Breed and size may be contextual inputs but never determine a compatibility label. Species must be confirmed by the owner; no photo-based species inference is required.

### FR-03: Select a situation
Present understandable routes: Bringing a pet home; Helping pets share the home; Daily care; Something changed; Someone else is caring for them; I am concerned. Derive pairing from selected pets. Record whether a dog or cat is the newcomer in mixed-species cases. Do not show a medically focused questionnaire as the normal home screen.

### FR-04: Intake and support routing
Use a short, reviewed structured intake. Ask only applicable questions; preserve not-sure responses. Route to guided preparation, coordination-only, clarification, professional-required, or urgent-help content. This is an application eligibility policy, not a diagnostic or severity-scoring system. An owner can describe more than one concern.

### FR-05: Build the home plan
Use named zone cards with resources, planned access, escape/retreat arrangements where relevant, and caregiver responsibilities. Access assignments are a plan, not sensor observations. Display the person and time of any last reported arrangement. No automatic locks, gates, feeders, treats, or pet-door changes. A list/form must provide every operation available by drag-and-drop.

### FR-06: Create relationships and contexts
Maintain unordered pet pairs plus a context record for each active case. Observations remain directional: animal A did X toward animal B in a particular setting. Unknown relationships are not generated as compatible. Adding a third animal invalidates assumptions that depend on the earlier participant set.

### FR-07: Review a plan
A plan revision binds case participants, home-layout version, household safety epoch, protocol version and locale, prerequisites, and current step. The owner reviews relevant prerequisites and limitations. A reviewed plan remains conditional and can be invalidated by later information.

### FR-08: Run a session
Before starting, recheck authorization, protocol status, acknowledgment of current handover, current revision, holds, and session conflict. Present one short reviewed instruction at a time, elapsed time if useful, an observation button, and a prominent stop/pause control. A clock is a session aid, never a command to progress. Resuming requires a fresh server check and an explicit human action.

### FR-09: Record observations
Accept typed input, structured choices, or short push-to-talk dictation. Separate the verbatim report, normalized observation, interpretation, and proposed consequence. Ask who did what when pronouns or multiple pets make the report ambiguous. Include actor, target if relevant, context, observed_at, reported_at, certainty, reporter, and source. Corrections append rather than erase prior records.

### FR-10: React to change
A concern can pause the relevant guidance, stale dependent steps, cancel old tasks, update the household handover, and generate a review requirement. A plain-language explanation must cite the reported event and applicable protocol rule. Do not silently advance or silently infer recovery from no further reports.

### FR-11: Household handover
The Today view prominently shows plan changes and tasks requiring acknowledgment. Acknowledgment means 'I read this version', not 'I performed the animal-care action'. Caregivers cannot start stale guidance simply because they previously acknowledged an earlier version.

### FR-12: Daily care
Owners configure meal, walk, litter, water, enrichment, rest-space, and sitter tasks. Quantities and frequencies are user-entered; no diet or exercise prescription. Each occurrence has planned, claimed, reported_done, skipped, uncertain, or canceled state. Multiple claims/reports are preserved, with conflict resolution rather than double-counting. 'Alex reported breakfast done at 08:10' is correct; 'Your pet ate' is not established.

### FR-13: Professional handoff
Generate a structured summary of participants, context, reported events, changes to the plan, unanswered questions, and source labels. Do not generate a diagnosis. Owner previews exact scope, destination, expiration, and content before sharing. R0 exports a private text/HTML file; PDF generation and professional case portals are optional later deliverables, not promised integrations.

### FR-14: Notifications
Separate internal task creation from attempted delivery and confirmed acknowledgment. Route changes invalidate queued progression prompts; workers recheck current versions before sending. Default notifications are discreet. Silence or failed delivery never means a caregiver agrees or the household is safe.

### FR-15: Voice and assistant
Support text equivalence, captions, microphone permission explanation, push-to-talk, barge-in, and local audio cancel. Do not call the browser an Echo, use Alexa certification marks, or imitate an official Amazon voice. Read only minimum approved household information through any future Alexa integration.

### FR-16: Content governance
Every practical module has a species/pairing scope, reviewer, original source references, version, locale, review state, exclusion list, expiry/re-review date, and revocation mechanism. Customer use is blocked when the applicable content is demo_only, unreviewed, revoked, or expired. No runtime scraping of random pet advice.

### FR-17: Export, archive, delete
Owners may export permitted household records and revoke shares. Archive a pet without rewriting earlier sessions. Do not automatically share a deceased/relinquished pet's details or infer that another animal should be adopted. Deletion follows published retention controls with visible processing state.

### FR-18: Account and billing
R0 has no real checkout. A later household pass can be activated only by a verified server-side billing event. Safety information, pause controls, essential records, and export are not blocked by an expired paid pass. Entitlements never override support-level limits.

## Required empty and failure states
No pets; only one pet; no relevant pair; missing intake; no approved module; review needed; expired sharing; denied microphone; unsupported audio; lost connection; uncertain synchronization; provider outage; notification failed; processing timed out; conflicting caregiver reports; deleted pet in historical record; revoked protocol; expired paid access.

## Nonfunctional targets - targets, not measured results
Local pause and audio cancel: p95 under 100 ms on supported test devices. Authenticated ordinary reads: p95 under 800 ms excluding external model work. First conversational response feedback: under 1 second; complete voice response target under 5 seconds under test conditions. Session UI usable at 200% zoom and 320 CSS-pixel viewport. No essential action requires audio, drag, color, or precise motor input. State integrity and welfare boundaries take priority over latency targets.

## Release acceptance
All three pairing fixtures pass the same core flow while using different protocols. A single-pet route needs no dummy second pet. A high-risk case has useful coordination/export functions without exposure guidance. The same pet cannot join two guided sessions. Revoked users lose access immediately on the server. A stale client cannot continue by replaying a successful request.
