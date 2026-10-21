# Denlumi — submission copy draft

Prepared October 18; reconciled October 21, 2026 Africa/Cairo against local P9 evidence and current official submission requirements. Technical entry copy saved to Devpost draft; personal inputs and final submission remain for the owner. See [readiness](docs/submission/READINESS.md) and the ordered [next-step packet](docs/submission/NEXT_STEPS.md). Published application release is `63ea23340909357bb4786f25dde8f43fbecc1570`, including the Node security patch and recorded serial checks. See the current delivery status. Do not paste this preparation note into the public description.

## Project name

Denlumi

## Tagline

One current plan for the people sharing a home with cats and dogs.

## Inspiration

A shared home can have several caregivers and several versions of what happened. One person records a concern; another returns with yesterday's plan. A conversational interface is useful only if it can recover the current household record, preserve uncertainty, and refuse work that has become stale.

Denlumi explores that coordination problem through a fictional Alexa-style browser simulation. The product hypothesis is that a clear handover and an appropriate pause can be more useful than another generic answer. We have not established customer demand or demonstrated animal behavior improvement.

## What it does

Denlumi connects a current plan, attributed reports, caregiver handovers and private factual records. In the fictional demonstration, an owner reviews the exact plan, each caregiver acknowledges the current handover, and a fresh preflight checks whether a software session may start.

An observation retains who reported it, which pet acted toward which pet, whether the statement is affirmed, negated or uncertain, and when it was observed versus reported. Human confirmation remains separate from the assistant's tools. A relevant concern pauses software guidance and makes dependent work stale. Another caregiver cannot continue with an old plan; a fresh conversation retrieves the current state through authenticated HTTP MCP.

The demonstration has distinct cat–cat, dog–dog and cat–dog contexts, including both newcomer directions. Single-pet care does not invent a second pet. A three-pet household keeps separate pair contexts and offers no group session. Routine reports remain reports: a caregiver reporting a task done is not proof that an animal ate or that an action occurred.

Local Stop works without a network or model. It stops this device's software and audio; it cannot separate, monitor or supervise animals. An offline household update remains visibly unsynchronized until the server commits it. Private factual previews and exports require explicit human action; the model cannot send records, invite people, clear holds, advance plans, change medication or operate devices.

## How we built it

The current local application uses Next.js 16.4.2, React 19.3.1, TypeScript and Node.js 22.23.4. Local Supabase Auth and PostgreSQL provide authenticated identities, household scope and persistent state. Consequential operations recheck authority and current versions, including a monotonic safety epoch that invalidates dependent work after a relevant change. Database constraints, row-level security and server checks support one another.

The simulation makes real authenticated Streamable HTTP MCP requests using protocol version `2025-11-25` and SDK 1.32.1. A new conversation retrieves database state rather than relying on chat history. Its bounded assistant has a six-tool-call total per turn and at most two model rounds. The demonstrated fallback answers are explicitly sourced from database templates. P9 added streaming request-size limits, read/write budgets and bounded transport admission, expiry and abort/deadline cleanup; these are local process controls, not distributed deployment protections.

AWS SDK integrations are present for Bedrock Converse, Amazon Polly and Amazon Transcribe Streaming. Earlier real Polly/Transcribe requests succeeded with fictional generated audio; a separate synthetic-microphone browser drill exercised actual speech endpoints and offline Stop. These are provider/software observations, not human voice acceptance. Real Bedrock inference attempts returned `ValidationException: Operation not allowed`; no successful Bedrock-generated answer or model-driven MCP loop is claimed. The most recent recorded AWS recheck expired, so current access is unverified.

## Challenges we ran into

The difficult work was preserving authority when state changes. Local checks exposed stale review controls after failed reads, a previous answer left visible beside a new error, a saved report whose refresh failure looked like a refused write, and report text cleared during delayed sample entry. We corrected those paths and recorded the evidence and its limits.

Bedrock onboarding also stopped at a real authorization blocker. Model discovery and an active inference profile did not establish permission to invoke it. We kept the blocked status visible and retained database-backed functionality. Accumulated older local fixtures previously caused database/Auth timeouts. A fresh native environment now passes the current suite, while the accumulated-old-fixture performance issue remains unverified.

## Accomplishments

The documented local slice connects exact plan review, separate authenticated caregiver acknowledgment, preflight, report, pause, stale-work refusal, fresh MCP retrieval and private preview across the supported fictional shapes. It includes permission, duplicate-work, failure and offline-Stop checks, and automated desktop reflow and native browser zoom evidence.

The current local P9 operations/security checks passed **227/227 domain/Auth/database tests, 60/60 production typed-browser tests and five isolated synthetic/mocked voice tests**, plus typecheck, production build, seven existing HTTP proofs, nine security HTTP checks and seven fictional pairing shapes. The voice mocks used no real provider endpoint or credential. The typed checks exercise keyboard, constrained reflow, zoom-related software behavior, reduced motion, forced colors, outage/deletion recovery and fictional pairing journeys. These are local automated results on the current source, not human accessibility/usability, clean-machine Docker replay or older-record recovery. Earlier 105/110-domain and 29-browser results retain their historical limits.

The local 104-second film contains real October 19 browser footage with original SVG explanation and Higgsfield Seed Audio's built-in Grady narration, edited and checked October 20. It predates final P9 dependency/security hardening; no updated recording of that build is claimed. Automated caption/decoding/playback checks and AI sampled-frame review do not establish human listening or voice acceptance.

## What we learned

An assistant's confident sentence cannot substitute for a current, authorized record. We made reported facts, uncertainty, software pause and human approval visible as separate states. A useful demo should also reveal provider failure without presenting a fallback as a successful model call.

## What's next

Remaining work includes accumulated-old-fixture performance/old-record recovery, clean-machine Docker replay and human supported-device usability/accessibility and voice acceptance. Provider latency/cost/retention verification, approved table-specific metadata retention, continuous consented cleanup, full backup expiry/restore and production-scale/real-operator withdrawal acceptance remain open. The latest AWS identity check expired, leaving current Bedrock authorization unknown. All bundled protocols remain `demo_only`; each exact practical version needs real qualified review before customer use. Local P9 automated hardening and bounded operations are complete within their recorded scopes; P9 human/operational acceptance and P10 media/final submission remain open.

## Track and technology fields

- Primary track recommendation: **Alexa+ — simulated experience**. This is a browser simulation with real local HTTP MCP, without native Alexa access, certification or a physical Amazon device. The [current official rules](https://amazonappdev2026.devpost.com/rules) permit this submission route.
- Optional AWS Builder: owner decision pending; describe the genuine speech integrations and blocked Bedrock attempt exactly as above. Do not claim eligibility or an award outcome.
- Open Source: not selected in this draft; no additional contribution URL or publication has been verified.
- Built with: Next.js, React, TypeScript, Node.js, Supabase Auth, PostgreSQL, Model Context Protocol, AWS SDK for JavaScript v3, Amazon Polly, Amazon Transcribe Streaming; Amazon Bedrock integration **blocked at inference**.
- Public code repository: https://github.com/AmirmLotfy/denlumi (MIT). Verified application release `63ea23340909357bb4786f25dde8f43fbecc1570` contains the latest local checks. Prior public base was October 18 `ae32fcb8cdd8f45996615bdf9c9addd357eb0805`.
- Public presentation: https://denlumi-showcase.vercel.app (static evidence site; interactive application remains local-only).
- Video: the **1:44 Grady/SVG replacement** is exported and locally checked; [review/upload packet and captions](docs/submission/UPLOAD.md). The owner approved the platform agreement and public upload. **Public video: https://www.youtube.com/watch?v=cbWwUAx-EMU**, with selectable English captions. The site's older 2:03 Samantha MP4 is historical and must not be used as the replacement or official video field.

## Internal claim references — remove this section when copying to Devpost

Behavior and current limits: [P9 operations handoff](docs/P9_OPERATIONS_HANDOFF.md), [Phase 8/9 handoff](docs/PHASE_8_9_HANDOFF.md), [Phase 6/7 closure](docs/PHASE_6_7_CLOSURE.md), [content gate](docs/CONTENT_REVIEW_PROCESS.md). Current official rules/FAQ and deadline were refreshed October 21 Cairo; October 23, 12:00 PDT is 22:00 Cairo. [Readiness](docs/submission/READINESS.md) records rule wording differences and freeze/access requirements. No final Devpost agreement or competition entry was submitted; the YouTube upload agreement was separately approved by the owner.

Recorded execution: [current P9 operations](evidence/phase9/operations-2026-10-21.json), [October 1 closure evidence](evidence/phase6/closure-2026-10-01.json), [seven fictional HTTP/MCP shapes](evidence/phase8/pairings.json), [browser coverage](evidence/phase8/browser.json), [blocked Bedrock app response](evidence/phase6/bedrock-app.json), [speech provider probes](evidence/phase6/providers.json), [synthetic-input live speech](evidence/phase6/voice-browser.json), [isolated database failure recovery](evidence/phase9/db-recovery.json), [offline Stop measurement](evidence/phase9/stop-latency.json), [actual local friction](docs/PHASE_8_FRICTION_LOG.md), [replacement film media](evidence/phase10/video-natural.json). These evidence files are working references; sanitize each before publication. Human film review and final owner/form declarations remain pending. Source and video publication are verified separately in the current delivery status.

October 21 local operations added a bounded nine-household withdrawal proof and an isolated current application-schema restore: 75 tables, 32 policies and eight access/session canaries matched. Original service ownership and nine future-object default-privilege entries were not reproduced; full-platform recovery remains open. See [operations handoff](docs/P9_OPERATIONS_HANDOFF.md). The [human task packet](docs/P9_HUMAN_ACCEPTANCE.md) starts NOT_RUN, and the [retention worksheet](docs/PHASE_9_METADATA_RETENTION_PROPOSAL.md) is unapproved. These preparations grant no practical-content, policy, human or production acceptance.

Local source reconciliation is prepared separately: [P10 source report](docs/P10_SOURCE_RECONCILIATION.md). Application release 63ea233 and the actual YouTube URL are verified in the delivery status. This draft is not evidence of final competition submission. The owner must confirm build-window provenance (new project versus existing-project changes), eligibility, team representation, asset rights and personal reuse answers before using the actual form.

Latest runtime continuation: official Node 22.23.4 was checksum-verified and installed task-locally; typecheck/build, 227 domain/Auth/database, 60 typed-browser, 5 mocked-voice, 11 unit, 9 setup, 6 export and zero-known audit checks passed. [Redacted runtime evidence](evidence/phase10/node-security-2026-10-21.json). No dependency inventory change, real provider request, hosted resource or human acceptance is claimed.

Current external status: [delivery receipt and limits](docs/submission/DELIVERY_STATUS.md); [manual personal fields/final submission](docs/submission/MANUAL_FINISH.md). Devpost draft is 3/5 complete and has not been submitted.
