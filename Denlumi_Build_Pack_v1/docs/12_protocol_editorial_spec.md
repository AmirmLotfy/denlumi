# 12 - Protocol editorial and publication specification

## A protocol is reviewed content, not a prompt
Each protocol defines an educational scope, structured prerequisites, relevant observations, allowed actions, and exclusions. The initial examples in this pack define software behavior only and are **not approved animal-handling instructions**.

## Required metadata
Stable protocol ID; version ID; species/pairing applicability; newcomer role when relevant; scenario category; original author; source references; reviewer identity and expertise scope; locale; lifecycle status; review date; next review date; revocation state; content digest; schema version.

## Lifecycle
`draft -> in_review -> approved -> revoked/expired`, with a parallel `demo_only` state that cannot become approved without a new review process. Approval requires original content review and an attributable record. A change to instructions, exclusions, or progression rules creates a new version and approval requirement.

## Module components
- Purpose and eligible scenario.
- What the module does not cover.
- Applicable prerequisites and unknown handling.
- Non-contact preparation tasks where appropriate.
- Original reviewed instructional text per step.
- Observable, behaviorally neutral questions for each participant.
- Reasons to pause or refer.
- Current-state requirements before a reviewed next-step proposal.
- A plain-language explanation and original source references.
- Owner acknowledgment content.
- A safe fallback when content is withdrawn.

No mandatory default session duration, exposure distance, contact threshold, vaccination timetable, medication instruction, or intensity escalation is supplied by this pack. Those require appropriate expert authorship and individual context. Do not have Codex guess them.

## Review criteria
Correct pairing and newcomer context; avoids coercion/aversives; distinguishes observation from inference; addresses resource/access requirements relevant to the species; no diagnostic language; no promise of friendship or supervision; appropriate professional escalation; neutral uncertainty handling; readable instructions; audio behavior that does not startle pets; fully equivalent non-audio access.

## Reviewer process
Commission qualified feline/canine expertise appropriate to each module. Verify credentials and scope directly, not through a generated biography. Record consent to display name/credential. A reviewer signs the exact content digest. A module is not 'veterinarian approved' because its sources include a veterinary website.

## Source and licensing policy
Use published sources to inform original content and attribution; do not import whole copyrighted guides into an open-source repository. Store only licensed text and short necessary excerpts. Do not collect customer videos as a training corpus. Clinical consultation records and customer-specific professional instructions are private and distinct from globally reusable educational modules.

## Publication gate
Production behavior checks status, approval record, locale, expiry, source/review validity, and applicable scenario. A module without approval renders a coordination-only view and a transparent explanation. Demo mode accepts only fictional fixtures and is isolated from live household records. No URL parameter can override these gates.

## Evaluation gate
Adversarial cases include negation, ambiguity, multiple pets, sudden medical change, severe conflict, a caregiver asking to skip steps, expired content, copied malicious instructions, translation drift, model outage, and spoofed reviewer identity. Review false reassurance and needless escalation separately. Passing a test set does not certify safety across all real animals.
