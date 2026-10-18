# 08 - Security, privacy, operations, and welfare governance

## Threat model
Risks include a revoked sitter reading ongoing records, a model operating on another household, malicious instructions embedded in notes, an ambiguous voice report changing the wrong pet's plan, stale guidance after a household update, duplicate jobs, leaked share URLs, and misleading claims about physical animal safety.

## Isolation
Every tenant-owned row contains household_id, directly or through a enforced composite relationship. Use composite foreign keys or equivalent transactional checks to prevent cross-household references. Enable RLS on all exposed tables and deny access by default. Do not expose a service-role key in the browser; privileged workers have narrowly scoped server-only credentials [S19]. A graph is relational data, not a reason to bypass RLS.

## Permissions
Caregiver grants bind pets/cases, role, expiration, and inviter. Review permission separately from view permission. Membership changes are audited and enforced on the next server request; short-lived signed object URLs limit stale exposure. A household subscription is not an access-control role.

## Personal and home data
Store approximate age bands for pets when exact dates are unnecessary. Do not require street addresses or a house floor plan. Home-zone labels are private. Photographs must be owned/authorized and optional; strip metadata on upload. No person/child identification, face recognition, voiceprints, or training on uploads by default.

## Audio and model providers
Record only explicitly requested input windows. Raw audio retention default: none after transcription completion, except brief transport buffering and provider processing as documented during deployment. State actual provider retention; do not advertise 'zero retention' without account configuration evidence. Store normalized confirmed text; draft transcripts have a proposed maximum 24-hour retention, configurable after privacy review.

Do not include private notes in telemetry, analytics, session replay, or ordinary error logs. Model prompts contain only needed context. Never allow provider traces with private content in the public hackathon repository.

## Share/export
Exports are owner-initiated and private. Proposed share-link expiry 72 hours, viewer session 30 minutes, with identity verification for sensitive content and immediate server-side revocation. These are product defaults, not legal requirements. No global public project IDs. Restrict download recipients to the exact approved scope; document that a recipient may retain a downloaded copy.

## Retention and deletion targets
Anonymous demo tenants expire after 24 hours. Proposed operational metadata retention 30 days; private text/session records remain until owner deletion or published account policy. Deletion request disables access first, removes primary objects/records through a verified job, and discloses actual backup expiry. Do not promise instant removal from historical backups. Implement separate legal/financial retention only after jurisdiction-specific review.

## Safety operations
A content kill switch revokes a version, identifies affected active plans, interrupts guidance, cancels pending progression notifications, and records the event. A safety incident report creates an internal review task; it does not automatically create a clinical record or contact a professional. Log whether guidance was template-based or model-generated and which version was used, while minimizing raw text retention.

## Availability and rollback
A provider outage falls back to existing approved static information, pause, and manual records. No new plan progression during uncertain state. Use transactional outbox and retries; alert on dead-letter queues. Back up the database and verify a restoration using fictional test data before customer launch. Treat schema migrations as reviewed changes; do not execute destructive changes against customer data to make a demo pass.

## Billing and consent
Use a provider legally available to the business after verifying onboarding, settlement, tax, cancellation, and data-processing terms. No provider has been onboarded through this specification. Webhooks require signature verification and event de-duplication. Paid entitlements do not gate urgent-help content, local stop, relevant existing records, or export.

## Human review gates
No practical real-animal protocol ships merely because an LLM wrote it or cited a source. Qualified feline/canine expertise is required for the relevant module; serious cases need veterinary behavior expertise as appropriate. Reviewer qualifications, scope, conflicts of interest, dates, and changes must be recorded. Claim 'reviewed by' only for the precise content and identity actually verified. No medical-device, regulatory, or animal-welfare certification is asserted.
