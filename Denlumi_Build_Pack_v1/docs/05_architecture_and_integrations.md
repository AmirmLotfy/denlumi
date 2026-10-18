# 05 - Architecture and integrations

## Stack decision
- Next.js App Router and TypeScript for app, public website, and authenticated endpoints.
- Vercel for the web deployment.
- PostgreSQL/Supabase for relational state and authentication. Use database RLS and server-side authorization together.
- S3 private objects for optional pet images, reviewed documents, and exports; do not keep raw session audio by default.
- Amazon Bedrock Converse for bounded extraction/conversation with a region/model actually enabled in the developer account.
- Amazon Transcribe for streaming push-to-talk input and Polly for optional output [S15, S16]. Typed mode always works.
- SQS + Lambda for exports, background summaries, and deliveries. EventBridge for periodic dispatch/cleanup.
- SES for opted-in email notifications and verification if selected. Internal inbox is the default for the anonymous demo.
- A real authenticated Streamable HTTP MCP endpoint for the demonstrator [S12].

One monorepo, one web app, one worker package, one domain package. No Kubernetes, Redis, graph database, separate vector database, mobile app, or multi-agent framework required for R0.

## Deployment boundaries
`apps/web`: UI, server session checks, HTTP routes, conversation orchestrator, MCP transport adapter.
`packages/domain`: permissions, eligibility routing, current-state validation, task and plan transitions.
`packages/contracts`: input/output schemas and generated types.
`packages/content`: original versioned reviewed material and demo-only fixtures.
`workers`: asynchronous jobs and notification delivery.
`infra`: AWS infrastructure as code with separate credentials and least-privilege policies.

Versions are selected and locked during Phase 0 from current official documentation. Do not assume a model ID, speech voice, SDK export path, or protocol version simply because it appears in a previous assistant answer. Record the exact working combination and request traces.

## Runtime paths
Text/voice input -> normalization -> short clarification when necessary -> permitted MCP tool call -> domain authorization/state check -> transaction -> current-state response -> template-led explanation or short model summary.

The orchestrator discovers permitted MCP tools, maps their schemas to Bedrock's tool interface, executes actual HTTP tool calls, and returns tool results. Bedrock tool use does not automatically become MCP merely because both words appear in the README. No decorative tool-call animations.

Critical guidance comes from approved module strings. Model output may explain an existing rule but must not add new handling instructions. Structured JSON ensures shape, not truth [S13]. Validate actor/target IDs, quoted report spans, enum values, and provenance before persistence.

## Voice implementation
Push-to-talk with visible recording state; use temporary scoped transport credentials/session tokens, never AWS long-lived secrets in the browser. Choose a supported encoding/sample rate in Phase 0. Names are resolved with a pet alias dictionary and explicit confirmation on ambiguity. Voice is not identity authentication.

Local stop cancels both queued and playing TTS and all local instruction progression. Do not wait for Transcribe or Bedrock to recognize the word before a physical button can stop. Capture only the bounded input window; exclude bystander conversation when possible. No always-listening promise or wake-word service in the browser.

## State and transactions
The database is authoritative. All writes recheck role, household membership, grant scope, expected safety epoch, relevant plan revision, and protocol status. Use `Idempotency-Key` and request-body hash for consequential writes. A repeated key with a different body is rejected.

For a safety update: lock the household -> append confirmed observation/event -> create or update hold -> increment safety_epoch -> stale dependent plan reviews -> interrupt affected session -> cancel dependent future tasks -> write handover/outbox/audit -> commit. Dispatch after commit. The app never announces an uncommitted household update.

For routine task completion: unique occurrence ID, attributed report, and conflict-aware effective status. For session start: enforce one active/interrupted-unresolved session per household with a database constraint or transactionally locked household row.

## Background tasks
SQS/Lambda delivery is at least once, so jobs need idempotent effects and retry-safe state [S14]. An outbox row is created in the same transaction as the domain event. Workers verify current safety epoch and permissions before delivery, not only when queued. A stale progression reminder is canceled, even after retries.

## Disconnect and offline behavior
Offline users may inspect a clearly stale plan and draft notes. They cannot start or advance guided sessions. A local stop works and visibly awaits synchronization. Keep sensitive cached content minimal; clear it at signout/revocation. A cached screen does not imply current access or household awareness.

## Alexa strategy
Hackathon: a plainly labeled simulated Alexa+ browser experience is explicitly permitted [S1]. The real MCP backend is our implementation choice, not a prerequisite of that alternative path. Use it for technical clarity and portability.

Production: selected-partner access and policy review remain separate gates [S2, S3]. No claim of native proactive Echo reminders, persistent listening, or speaker interruption. MCP is not itself an alarm API. Keep person-identifying household details and sharing approvals in the authenticated app.

For a future MCP add-on use its specific account-linking requirements, including OAuth 2.1/PKCE S256 [S18], rather than confusing the generic legacy Skills account-linking documentation with the MCP path. Browser authentication does not automatically implement Amazon account linking.

## Runtime safeguards
Per-user/household budgets; maximum 6 tool calls per conversational turn initially; cap output length; use no more than the applicable module and recent relevant events as context. Long-term history is database retrieval, not an ever-growing chat. Fallback to current plan and manual logging on model outage. Emergency/help content and local stop do not require model availability.
