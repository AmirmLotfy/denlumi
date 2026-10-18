# Phases 6 and 7 — closed locally with deferred acceptance

Updated 2026-10-01 under the owner's instruction to finish all locally closable work and postpone unavailable acceptance. **Phase 6 and Phase 7 local implementation is closed. Provider, human voice and release acceptance remain explicitly deferred.** Supabase is local-only: no project was linked/created, no migration ran in this refresh, and nothing was deployed.

## Final local fixes

- Leaving a sample clears unsaved check-ins/reports, identities, assertion/time fields, voice provenance/deadline, captions and media resources. Generation checks refuse late household and speech responses. If logout cannot be confirmed, local content is still cleared and the visible retry must succeed before another sample opens.
- Same-origin logout revokes only the sessions in the supplied cookies and remains retryable when one session was already revoked. Missing/invalid sessions can clear their cookies; actual Auth failures still return an honest 503. Other identities and resource authentication remain protected. This follows the pinned Supabase Auth client's inactive-session handling ([official sign-out reference](https://supabase.com/docs/reference/javascript/auth-signout)).
- Each conversational turn permits at most six authenticated MCP tool calls in total. The model gets four read calls for a current-plan turn or three when a selected detail read is needed, reserving both initial/final state reads. Two model rounds remain the limit. Model prose is not rendered as practical guidance.

## Actual checks on the current code

| Check | Result | Evidence limit |
|---|---|---|
| State/provider-boundary/local-Stop/conversation/private-record/speech-boundary selection | **58/58 PASS** | Real localhost Supabase/Auth with deterministic model-loop/provider-boundary tests. Includes the existing local retention tests; not the complete checkout suite. |
| New sign-out Auth tests | **2/2 PASS** | Real two-session revocation, unrelated identity preservation, invalid/absent/replayed cookies and partial-success retry; caregiver outage injected. |
| `npm run typecheck` | **PASS** | Local TypeScript. |
| `npm run build` | **PASS** | Production compilation, no deployment. |
| `npx playwright test tests/e2e/phase6.spec.ts tests/e2e/phase7.spec.ts` | **6/6 PASS** | Production localhost app, desktop Chrome, Bedrock disabled, speech UI enabled. Synthetic microphone and mocked speech responses; real Auth/database/MCP/private-record actions. |
| `npm run test:phase6:http` | **PASS** | Actual authenticated Streamable HTTP MCP discovery/calls, current plan, ambiguous negated report, fictional pause, stale caregiver refusal, fresh conversation, tenant denial. No AWS call. [Trace](../evidence/phase6/http.json). |
| `npm run test:phase7:http` | **PASS** | Actual cookie Auth, exact preview, changed-recipient refusal, verified recipient read, immediate revocation, disabled-first primary deletion. No external send or backup erasure. [Trace](../evidence/phase7/http.json). |
| AWS read-only availability recheck | **BLOCKED: session expired** | CLI exit 255. No fresh model availability obtained and no new inference request made. The last completed documented check on 2026-09-28 was `NOT_AUTHORIZED`. |

[Closure evidence](../evidence/phase6/closure-2026-10-01.json) records exact commands and limits. Raw local logs are ignored under `.local/phase67-oct1/`. The new privacy test first reproduced the previous voice draft in the next sample; it passes after the fix. Initial logout retry tests exposed the SDK's missing-session error and passed after that was handled. The earlier broad Phase 9 regression was stopped after database/Auth timeouts; this refresh does **not** claim a current complete-checkout pass. Three generic production-server `TypeError` messages were not correlated to requests; all asserted checks passed, but no error-free-server claim is made. Correlating these diagnostics remains a follow-up with the Phase 8/9 reliability work.

## Delivered behavior

Phase 6 provides bounded authenticated HTTP MCP conversation, current-database answers in fresh conversations, explicit identity/negation/time review, typed fallback, bounded push-to-talk transport, captions and network/model-independent local Stop. The model cannot advance plans, clear professional restrictions, share externally, invite users, change medication or operate devices.

Phase 7 provides attributed factual private summaries with report direction, uncertainty, correction history, timing, provenance and recorded plan revision/step sources; immutable exact-content preview/authorization; private text/HTML downloads; verified-recipient expiring/revocable grants; archive; and disabled-first, retryable whole-household primary deletion. Downloaded copies and backups cannot be claimed erased. Verified email is not a professional credential.

All three species pairings, single-pet and separate multi-pet coordination remain supported by the underlying household slice. Bundled protocols remain `demo_only`; no qualified reviewer or practical real-animal guidance is invented. The browser is labeled an Alexa-style simulation, without a physical device or native Alexa certification.

## Explicit deferrals and prohibitions

| Gate | Disposition / reason | Smallest resumption check |
|---|---|---|
| Successful Bedrock model-driven HTTP MCP read | **Deferred.** Earlier real Converse requests failed `ValidationException: Operation not allowed`; last completed availability was `NOT_AUTHORIZED`; today's login session expired. No successful inference claimed. | After credentials and authorization work, one bounded real app turn, verifying model-request trace and authenticated MCP tool use. |
| Human microphone, audible playback and Stop | **Deferred to human/device acceptance.** Prior real Polly/Transcribe requests and synthetic-browser playback passed; no person tested their microphone or hearing. | One observed fictional capture/playback/offline-Stop check on a supported device. |
| Provider retention / backup expiry or erasure / continuous operations | **Deferred to operational acceptance.** Local transient audio and primary cleanup do not prove these. | Verify actual provider settings and a narrowly scoped operational retention/restore drill. |
| Qualified exact-version practical content | **Release gate stays closed.** No reviewer or signed version exists. | Obtain genuine in-scope review before enabling practical guidance or a real-animal pilot. |
| Hosted Supabase, remote migrations or deployment | **Prohibited by the owner and AGENTS.md rule 15.** Not an automatic follow-up task. | Only a later explicit owner instruction can change the restriction. |
| Physical device actions / native Alexa claims / external sending | **Unimplemented and unclaimed.** The simulation and private records are the authorized local product. | Separate authorization and genuine provider/platform evidence would be required. |

The smallest Phase 6 acceptance slice is the single Bedrock-driven MCP read after access changes. Local closure requires no action from the owner now. The broader Phase 8/9 work remains separate and unfinished; see [its handoff](PHASE_8_9_HANDOFF.md). Historical commands and provider request IDs remain in [PHASE_6_7_HANDOFF.md](PHASE_6_7_HANDOFF.md) and the [acceptance audit](PHASE_6_7_ACCEPTANCE_AUDIT.md).
