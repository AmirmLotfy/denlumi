# Product feedback and friction draft

Prepared 2026-10-18 from recorded execution and source, with no new provider calls or tests. This is agent-run development/QA feedback on fictional records, not customer research. The owner should confirm first-person preference answers before copying to Devpost. The [official update](https://amazonappdev2026.devpost.com/updates) asks entrants to cover purpose, strengths, problems, onboarding and future use for each tool/API/SDK.

## Amazon-facing feedback

### Alexa+ simulated-experience route

**Used for:** a browser interaction model with current household state, explicit review surfaces and local Stop. We implemented our own authenticated HTTP MCP, without native Alexa enrollment, an Agent Skill deployment or a physical device.

**Worked:** the simulation route let us build and evaluate persistent state and caregiver transitions without pretending to have native-platform access. [Recorded real MCP requests](../../evidence/phase6/http.json) cover initialization, discovery, scoped calls and fresh-conversation retrieval.

**Needs work:** our evidence does not evaluate the native Alexa SDK, account linking, Echo behavior or certification. We cannot give firsthand feedback on those surfaces. An official end-to-end simulation example showing human-only confirmation, stale-state refusal and offline Stop would be useful (**Important** feature request).

**Onboarding:** local HTTP MCP reached working initialization/discovery/calls; native Alexa onboarding was not attempted. **Build again:** proposed **Yes**, for stateful coordination, retaining explicit human authority. Owner preference confirmation pending.

### Amazon Bedrock Converse / AWS SDK for JavaScript v3

**Used for:** a bounded Nova Micro orchestration path that can retrieve scoped context, with two model rounds and six total MCP calls per turn. The tested dependency is `@aws-sdk/client-bedrock-runtime` **3.1133.0**. Successful production model use is not claimed.

**Worked:** the app reported a real provider failure and retained an explicit current-database fallback. This is successful failure handling, not successful inference.

**Needs work:** a bounded request for `us.amazon.nova-micro-v1:0` in `us-east-1` returned HTTP 400 `ValidationException: Operation not allowed`. A later read-only availability result was `NOT_AUTHORIZED` while agreement, entitlement and region were `AVAILABLE`; the inference profile was active. These checks did not explain the underlying authorization cause. The latest recorded recheck expired. We did not change IAM, billing, model agreements or accounts. [Provider evidence](../../evidence/phase6/providers.json), [app fallback evidence](../../evidence/phase6/bedrock-app.json), [closure](../PHASE_6_7_CLOSURE.md).

**Onboarding:** authenticated discovery was not equivalent to a successful first Converse response; the model hello-world gate remains blocked. **Build again:** proposed **Yes, conditional on resolved access**, because bounded orchestration fits the design; runtime model quality and latency are unevaluated. **Feature request: Critical** — identify the failed authorization layer and actionable next check rather than returning a generic operation refusal. This is a request, not a diagnosis of the cause.

### Amazon Polly / AWS SDK for JavaScript v3

**Used for:** explicitly requested speech with matching captions and bounded input, via `@aws-sdk/client-polly` **3.1133.0**.

**Worked:** an actual fictional probe returned HTTP 200 and 62,012 bytes of 16 kHz PCM. A separate browser drill with generated synthetic input made real speech calls, started playback and paused the audio element through offline Stop. [Provider probe](../../evidence/phase6/providers.json), [browser drill](../../evidence/phase6/voice-browser.json).

**Needs work:** no person confirmed audibility, comfort or device behavior. We have not verified provider retention or billing reconciliation. No Polly service defect is established by this evidence. A reference pattern coordinating interruption, captions and stale-state cancellation would help (**Important**).

**Onboarding:** the bounded PCM request reached a successful provider response; human listening acceptance remains open. **Build again:** proposed **Yes**, with an equivalent typed route and human playback/Stop checks. Owner preference confirmation pending.

### Amazon Transcribe Streaming / AWS SDK for JavaScript v3

**Used for:** explicit push-to-talk, at most 15 seconds of mono signed 16-bit 16 kHz PCM, via `@aws-sdk/client-transcribe-streaming` **3.1133.0**. Draft transcripts require human review; they do not create confirmed observations automatically.

**Worked:** real provider processing of 1.937875 seconds of generated fictional audio returned a transcript; the later synthetic-microphone browser drill exercised actual authenticated app/provider calls.

**Needs work:** the returned phrase spelled the product name “Dinlumi.” One generated sample cannot establish general recognition accuracy, but it demonstrates why name attribution and confirmation matter. Human microphone use, accents, noisy rooms, latency and provider retention are unverified. An explicit reference flow for ambiguous pet names and reviewable transcripts would help (**Important**). [Probe](../../evidence/phase6/providers.json), [browser evidence](../../evidence/phase6/voice-browser.json).

**Onboarding:** the generated-audio hello-world path worked; human speech acceptance did not run. **Build again:** proposed **Yes**, subject to those checks and a complete non-audio route. Owner preference confirmation pending.

## Remaining tool and SDK inventory

Versions below come from the pinned [package manifest](../../package.json) and lockfile, not a claim that they are the newest versions. Strengths and limitations describe this project only. “No tool defect isolated” means exactly that; internal application errors should not be attributed to a vendor without evidence.

| Tool / tested version | Use and observed strengths | Friction / onboarding limit | Proposed reuse answer |
|---|---|---|---|
| `@modelcontextprotocol/sdk` 1.30.0 | Streamable HTTP, protocol `2025-11-25`; real initialization, discovery and scoped calls | Full local HTTP path reached working state. Authentication, origins and human-only confirmation required our own boundaries; no SDK defect isolated | Yes — real protocol boundary with explicit authority |
| `@supabase/supabase-js` 2.116.0 | Local Auth identity, session revocation and real two-session logout checks | Local identity flow works. Retry handling had to recognize the client's already-inactive session outcome. No hosted onboarding or hosted behavior evaluated | Yes — local reproducibility; hosted use remains prohibited here |
| `pg` 8.23.0 / local PostgreSQL | Transactions, locks, scope checks, RLS and immutable state bindings | Accumulated fictional fixtures caused statement/Auth timeouts in broad runs. A household-scoped read was improved; complete current regression remains open. No PostgreSQL defect established | Yes — authoritative transactions, with query/fixture investigation |
| Supabase CLI / Docker-compatible runtime (Colima on this Mac) | Isolated localhost database/Auth and local migrations | Local stack worked in recorded checks. Startup resources matter; portable setup must remove the machine-specific socket assumption. Tool versions are not established by this packet | Yes — local isolation; record exact runtime versions in judge setup |
| Next.js 16.3.5 | Web UI and authenticated same-origin HTTP routes; recorded production compilation passed | Read Origin handling and write-versus-refresh error messaging were app fixes. Generic server diagnostics remain uncorrelated; framework cause unproven. Full cold judge install not rerun here | Yes — shared web/server surface |
| React / React DOM 19.3.0 | Connected plan/routine/private-record views and persistent Stop | Async view changes erased an earlier notice/report input; stale controls required explicit clearing. These are app state bugs, not established React defects | Yes — with explicit async state ownership |
| Zod 4.6.5 | Tool and endpoint argument validation | Extra/forged arguments are covered in recorded boundary tests; no separate Zod onboarding timing or defect logged | Yes — validate before authority checks |
| TypeScript 6.0.3 and `@types/node` 22.20.3, `@types/pg` 8.23.1, `@types/react` 19.3.0, `@types/react-dom` 19.2.3 | Static contracts and recorded successful typecheck | Static checking does not validate authorization, welfare, provider success or runtime correctness; no separate onboarding notes recorded | Yes — useful contracts alongside behavioral checks |
| `tsx` 4.23.13 | Local serial TypeScript tests and evidence scripts | One disk-pressure `ENOSPC` interruption was environmental, not a passing test or established tsx defect. Only the identified unused Denlumi cache was removed in that earlier task | Yes — lightweight scripts within resource limits |
| Playwright / `@playwright/test` 1.63.0 | Actual local browser flows, injected failures, synthetic microphone, reflow and headed native browser zoom | A shared database pool teardown and entry-readiness race needed test fixes; optional headless-shell download timed out while headed Chromium installed. No human usability is established | Yes — reproducible software checks, separate from human acceptance |
| Node.js / npm | Runtime and workspace install; manifest requires Node >=22.13.1 and declares npm 10.9.2 | `npm ci` succeeded historically. The prior pack recorded a broken installed pnpm launcher and the decision to use npm; no new clean install or current runtime version check here | Yes — retain the pinned lockfile and document tested runtime |
| Codex / agent-assisted development | Source changes, local QA, evidence recording and drafting across the implementation history | Agent inspection is not independent human, professional or customer acceptance. No model/version inventory or firsthand onboarding measurement was recorded for this feedback packet | Owner to confirm personal reuse preference and exact authoring-tool disclosure |

Only relevant installed dependencies are listed; no Bee, Ring, Fire TV, AgentCore, Strands, S3 runtime or native Alexa integration is claimed. If the owner used additional authoring tools or assets, add their actual details before submission.

## Optional friction entries

Severity below is a submission-draft assessment, not an original measured severity scale. Historical tests were not rerun for this packet.

| Task and steps | Expected / actual | Severity and workaround | Actionable suggestion and evidence |
|---|---|---|---|
| Invoke bounded Bedrock Converse after authentication; inspect model availability | Expected one response. Actual 400 `ValidationException`; availability later `NOT_AUTHORIZED` despite available prerequisite fields | Critical for model acceptance. Visible provider-blocked status and real database/MCP fallback | Return a specific failed authorization layer. [Provider result](../../evidence/phase6/providers.json), [app result](../../evidence/phase6/bedrock-app.json) |
| Transcribe generated fictional product-name phrase | Expected faithful phrase. Actual “Dinlumi” spelling in one sample | Important for attribution. Human transcript review and explicit pet selectors; no accuracy benchmark claimed | Provide ambiguity/review examples for proper names. [Probe](../../evidence/phase6/providers.json) |
| Open Today/history through authenticated browser GET without Origin | Expected authorized read. Actual `INVALID_ORIGIN` from our route guard | Important app defect, fixed. Permit absent Origin on guarded reads; retain mutation protections | Document read/write request expectations in our API. [Local friction log](../PHASE_8_FRICTION_LOG.md) |
| Ask for current state while assistant GET/turn fails | Expected error with no misleading old answer. Actual old answer initially persisted | Important app defect, fixed. Clear prior answer before new turn and retain Stop | Keep failure UI tied to the requested state generation. [Log](../PHASE_8_FRICTION_LOG.md), [isolated database drill](../../evidence/phase9/db-recovery.json) |
| Run broad serial regression against accumulated fictional revisions | Expected complete regression. Actual statement/Auth timeouts; broad attempts stopped | Important unresolved local reliability gap. Selected checks ran; old unconsented fixtures were preserved | Investigate scope/query plans/Auth pressure without weakening denial tests or purging fixtures. [Current boundary](../PHASE_8_9_HANDOFF.md) |

## Copying and redaction

Copy the relevant feedback text, not raw private logs. Publish no provider request IDs, AWS account identity, auth tokens, local deletion/recovery codes or household records. Internal bug feedback is labeled as such. These entries make no claim that Amazon reviewed them, a support case was sent, the provider issue was resolved, or a bonus was earned.
