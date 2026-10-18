# Denlumi — submission copy draft

Prepared 2026-10-18. Local drafting only; not submitted. Missing links and access decisions are tracked in [the readiness checklist](docs/submission/READINESS.md). Do not paste this preparation note into the public description.

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

The web application uses Next.js, React and TypeScript. Local Supabase Auth and PostgreSQL provide authenticated identities, household scope and persistent state. Consequential operations recheck authority and current versions, including a monotonic safety epoch that invalidates dependent work after a relevant change. Database constraints, row-level security and server checks support one another.

The simulation makes real authenticated Streamable HTTP MCP requests using protocol version `2025-11-25`. A new conversation retrieves database state rather than relying on chat history. Its bounded assistant has a six-tool-call total per turn and at most two model rounds. The demonstrated fallback answers are explicitly sourced from database templates.

AWS SDK integrations are present for Bedrock Converse, Amazon Polly and Amazon Transcribe Streaming. Earlier real Polly/Transcribe requests succeeded with fictional generated audio; a separate synthetic-microphone browser drill exercised actual speech endpoints and offline Stop. These are provider/software observations, not human voice acceptance. Real Bedrock inference attempts returned `ValidationException: Operation not allowed`; no successful Bedrock-generated answer or model-driven MCP loop is claimed. The most recent recorded AWS recheck expired, so current access is unverified.

## Challenges we ran into

The difficult work was preserving authority when state changes. Local checks exposed stale review controls after failed reads, a previous answer left visible beside a new error, a saved report whose refresh failure looked like a refused write, and report text cleared during delayed sample entry. We corrected those paths and recorded the evidence and its limits.

Bedrock onboarding also stopped at a real authorization blocker. Model discovery and an active inference profile did not establish permission to invoke it. We kept the blocked status visible and retained database-backed functionality. Accumulated local fixtures later caused database/Auth timeouts during broad regression attempts; a current complete-checkout pass remains outstanding.

## Accomplishments

The documented local slice connects exact plan review, separate authenticated caregiver acknowledgment, preflight, report, pause, stale-work refusal, fresh MCP retrieval and private preview across the supported fictional shapes. It includes permission, duplicate-work, failure and offline-Stop checks, and automated desktop reflow and native browser zoom evidence.

The latest recorded October 1 maintenance checks passed a selected 58-test domain set, two Auth tests, six browser tests, typecheck/build and both phase-specific HTTP proofs. An earlier full suite passed 105/105 before later maintenance edits; that result is historical. We have not run new tests for this submission draft or established a current full regression pass.

## What we learned

An assistant's confident sentence cannot substitute for a current, authorized record. We made reported facts, uncertainty, software pause and human approval visible as separate states. A useful demo should also reveal provider failure without presenting a fallback as a successful model call.

## What's next

Next engineering work is the accumulated-fixture database/Auth timeout investigation and request-correlated diagnostics. Before real-world use, Denlumi needs observed human usability and accessibility checks, supported-device and human voice acceptance, operational privacy/retention verification, and qualified review of each exact practical protocol version. All bundled protocols remain `demo_only`; none is professionally approved animal-handling guidance. Phases 8/9 remain in progress.

## Track and technology fields

- Primary track recommendation: **Alexa+ — simulated experience**. This is a browser simulation with real local HTTP MCP, without native Alexa access, certification or a physical Amazon device. The [current official rules](https://amazonappdev2026.devpost.com/rules) permit this submission route.
- Optional AWS Builder: owner decision pending; describe the genuine speech integrations and blocked Bedrock attempt exactly as above. Do not claim eligibility or an award outcome.
- Open Source: not selected in this draft; no additional contribution URL or publication has been verified.
- Built with: Next.js, React, TypeScript, Node.js, Supabase Auth, PostgreSQL, Model Context Protocol, AWS SDK for JavaScript v3, Amazon Polly, Amazon Transcribe Streaming; Amazon Bedrock integration **blocked at inference**.
- Code repository, video and any judge-access link: **not yet supplied or verified**. Never substitute a localhost URL for an externally accessible link.

## Internal claim references — remove this section when copying to Devpost

Behavior and current limits: [Phase 8/9 handoff](docs/PHASE_8_9_HANDOFF.md), [Phase 6/7 closure](docs/PHASE_6_7_CLOSURE.md), [content gate](docs/CONTENT_REVIEW_PROCESS.md).

Recorded execution: [October 1 closure evidence](evidence/phase6/closure-2026-10-01.json), [seven fictional HTTP/MCP shapes](evidence/phase8/pairings.json), [browser coverage](evidence/phase8/browser.json), [blocked Bedrock app response](evidence/phase6/bedrock-app.json), [speech provider probes](evidence/phase6/providers.json), [synthetic-input live speech](evidence/phase6/voice-browser.json), [isolated database failure recovery](evidence/phase9/db-recovery.json), [offline Stop measurement](evidence/phase9/stop-latency.json), [actual local friction](docs/PHASE_8_FRICTION_LOG.md). These evidence files are working references; sanitize each before any publication.
