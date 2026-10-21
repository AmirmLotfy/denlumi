# Submission readiness — October 22, 2026 Africa/Cairo

**Current authoritative state: source and the 1:44 Grady film are public; Devpost technical draft is saved at 3/5 steps. All nine personal fields, three eligibility declarations and final agreement remain for the owner, and Submit project is unpressed. The owner has authorized showcase deployment and clean-setup validation; both are in progress. Use [delivery status](DELIVERY_STATUS.md) for actual completed results and [manual finish](MANUAL_FINISH.md) for the owner's final actions.** No showcase or clean-machine Docker success is inferred here.

The October 21 preparation pause was subsequently resumed. [Next steps](NEXT_STEPS.md) leads with the current authorized work. The updated local showcase assets match the public film and are listed in the [asset register](ASSET_REGISTER.md). Full human watch/listen, narration/output rights and personal declarations remain owner gates despite publication. Historical preparation sections below retain their date and original evidence limits.

## Deadline and rules checked during October 21 preparation

Refreshed October 21 Cairo (October 20 UTC) from the readable official [overview](https://amazonappdev2026.devpost.com/), [rules](https://amazonappdev2026.devpost.com/rules), [FAQ](https://amazonappdev2026.devpost.com/details/faqs), [final-stretch update](https://amazonappdev2026.devpost.com/updates/46539-final-stretch) and [feedback guidance](https://amazonappdev2026.devpost.com/updates/46538-strong-submission-tips). That rules refresh did not verify the owner's declarations. Later actual draft/form readback is recorded in [delivery status](DELIVERY_STATUS.md); this document edit performs no new external verification.

The [official overview](https://amazonappdev2026.devpost.com/) lists **Friday, October 23, 2026 at 12:00 PDT**. That is **19:00 UTC / 22:00 Africa/Cairo on October 23**, with Cairo at UTC+3. Conversion was checked using Python `zoneinfo` for `America/Los_Angeles` and `Africa/Cairo`, not a fixed year-round offset. A prudent owner target is October 22 at 22:00 Cairo; this earlier target is our recommendation, not the official deadline.

The rules retain a September 16 repository update allowing private GitHub source shared with reviewers. The latest final-stretch checklist mentions public source only; the rules, overview and FAQ still expressly allow either route. The chosen public MIT route avoids that wording discrepancy. The Alexa+ simulation route needs neither a specific framework nor an MCP-shaped surface; Denlumi implements actual local HTTP MCP. The FAQ explicitly accepts a locally runnable public repository plus video without hosting or continuously running MCP. Supabase remains local-only.

Judging access must remain free through November 20, 12:00 Pacific = 20:00 UTC = 22:00 Cairo (UTC+2). The final-stretch update separately asks entrants to freeze repository, video and project materials after the deadline until the scheduled December 3 winner announcement. Do not confuse the access minimum with permission to change submitted materials.

## Deliverable checklist

The [overview submission requirements](https://amazonappdev2026.devpost.com/) require source/setup access, description, a public YouTube/Vimeo demo under three minutes, tool feedback and track selection. A public website is not required. English materials are required or must have English translations. The [updates page](https://amazonappdev2026.devpost.com/updates) emphasizes specific feedback, including onboarding and whether the entrant would use each tool again.

| Item | Current evidence / next action | State |
|---|---|---|
| Project description | Factual copy, name/pitch and AI disclosure saved; owner editorial/rights review remains | Technical draft saved |
| Video | [Public 1:44 Grady film](https://www.youtube.com/watch?v=cbWwUAx-EMU), exact local MP4 hash `1a8b63b138c151002519302703345e77008034805c8a43dac7f071d5b2f589ca`; matching selectable English captions | Published; full human listening/rights open |
| GitHub source and instructions | [Application release `63ea233…`](https://github.com/AmirmLotfy/denlumi/commit/63ea23340909357bb4786f25dde8f43fbecc1570), anonymous source/license/setup/runtime readback matched | Published |
| Reviewer delivery choice | Public MIT source selected; no collaborator invitations needed | Public source |
| Portable source package | Selected application/source ZIP attached to Devpost; later metadata receipts are separate from the executed application snapshot | Saved; fresh native setup passed |
| Judge run instructions | [Judge setup](../JUDGE_SETUP.md); prior native/source-folder replays are local evidence. Current authorized clean-setup work must report its actual environment and results | Fresh native route passed; Docker attempt failed |
| Showcase | Current local player, 104-second film, poster, captions/transcript and public YouTube link prepared; static-only deployment authorized | Deployed; public bytes and muted playback verified |
| Working demo replay | Node 22.23.4 typecheck/build, 227 domain/Auth/database, 60 typed-browser, five mocked voice, 11 unit, nine setup and six export checks passed; film capture is October 19 | Local software evidence; no human/provider acceptance |
| Feedback | Factual questions 1–4, feature/friction entries saved; question 5 is saved with the owner-confirmed Yes; remaining personal/survey answers remain for owner | Technical feedback saved; personal fields blank |
| Primary track | Alexa+ selected in saved actual form; no native Alexa connection claimed | Saved |
| Mini-challenges | AWS Builder Yes with factual historical speech/blocked Bedrock write-up; Open Source No without additional verified contribution | Saved |
| Eligibility, rights and team representation | Eight remaining personal fields blank; three age/jurisdiction/non-employee declarations unchecked. Source MIT does not settle narration/output rights | Owner manual completion |
| Public links and final submission | Source/video readback verified. Devpost is 3/5 draft; final rules/terms unchecked and Submit project unpressed | Not finally submitted |

For private GitHub access, the refreshed rules/FAQ identify five Amazon users: `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`. The old `chris-trag` entry is absent. Confirm the live Devpost contact and instructions before any separately authorized invitation. Invitations expire after seven days and require acceptance. No collaborator was added here. Credentials belong in a private testing channel only, never public copy, source or video.

## How to make the case to judges

The [official judging criteria](https://amazonappdev2026.devpost.com/rules) are equally weighted: implementation, design, impact and idea quality. Optional friction logs can earn up to a 10% bonus; no bonus is guaranteed.

| Criterion | Concrete Denlumi demonstration | Limit to disclose |
|---|---|---|
| Implementation | Real authenticated HTTP MCP, versioned state, stale caregiver refusal, offline Stop | Local simulation; Bedrock inference blocked |
| Design | One connected review → handover → session → report → pause → private preview | Automated browser evidence; human usability open |
| Impact | Specific caregiver coordination failure: another person has an outdated plan | Product hypothesis; no customer or animal outcome claim |
| Idea quality | Current shared state survives conversation boundaries; human actions retain authority | No autonomous handling, supervision or native Alexa claim |

## Current engineering and product limits

The selected runtime is task-local **Node 22.23.4 / npm 10.9.9**, checksum-verified without changing dependency versions or the system runtime. [Runtime evidence](../../evidence/phase10/node-security-2026-10-21.json) records typecheck/build, 227 domain/Auth/database, 60 typed-browser, five mocked voice, 11 unit, nine setup, six export and zero-known lockfile audit results. The showcase update is deployed and public file hashes/range playback are verified. Fresh native setup passed 227 domain/Auth/database,60 typed-browser,5 mocked-voice,11 unit,11 setup and7 export checks, real HTTP MCP and9 HTTP security checks. [Fresh setup](../P10_CLEAN_SETUP_2026-10-22.md) retains the same-Mac and failed-Docker boundaries.

Human [H01–H08](../P9_HUMAN_ACCEPTANCE.md) remain NOT_RUN, qualified practical content review remains absent, and voice/provider/retention/older-data/full-platform recovery gates remain open. Bedrock inference was historically refused and latest identity expired; authorization is unknown. Historical Polly/Transcribe generated-input calls and mocked voice checks do not establish human speech acceptance or current provider authorization. Film publication is not human listening, legal-rights clearance or animal-outcome evidence.

Supabase stays strictly local-only. Static showcase deployment and clean local validation do not authorize a hosted project, remote migrations, paid resources or a practical/customer launch. Source MIT licensing remains separate from narration/output terms. The [manual finish](MANUAL_FINISH.md) packet preserves all personal and final-declaration boundaries.

## Historical October 21 engineering and read-only preparation snapshot

Before the later Node security patch and publication, the [P9 operations handoff](../P9_OPERATIONS_HANDOFF.md) recorded 227/227 domain/Auth/database, 60/60 typed-browser, five synthetic/mocked voice tests, seven HTTP proofs, nine security HTTP checks and seven fictional pairing shapes. That earlier snapshot used Node 22.23.3; the current selected 22.23.4 runtime and its rerun evidence are listed above. October 19's 110/110 and 29/29 counts remain separately dated.

The preparation refresh read public GitHub head `ae32fcb8cdd8f45996615bdf9c9addd357eb0805` and the former 5,640,915-byte Samantha showcase MP4. Those reads are historical and do not describe current source or prepared showcase assets. The later final Grady film retained exact SHA-256 `1a8b63b138c151002519302703345e77008034805c8a43dac7f071d5b2f589ca`. Existing [media](../../evidence/phase10/video-natural.json), [playback](../../evidence/phase10/video-film-browser.json) and [sampled-frame](../../evidence/phase10/video-film-visual.json) checks did not establish human listening; the actual October 19 capture still predates final P9 runtime pins.

October 21 local operations also supplied a bounded nine-household withdrawal proof and isolated application-schema restore: 75 tables, 32 policies and eight canaries matched. Original service ownership and nine future-object default-privilege entries were not reproduced. Full-platform recovery and older-record acceptance remained open; see [operations handoff](../P9_OPERATIONS_HANDOFF.md). The [retention worksheet](../PHASE_9_METADATA_RETENTION_PROPOSAL.md) remained unapproved, and no retroactive unconsented purge was authorized. These historical checks did not accept practical content, human usability or production operations.

## Smallest next action

The coordinator has recorded the verified native setup and deployed showcase outcomes in [delivery status](DELIVERY_STATUS.md); current source/archive/form parity is reconciled there. The owner completes the full film watch/listen and [manual finish](MANUAL_FINISH.md): the eight remaining personal fields, three eligibility declarations and final agreement remain untouched. No final submission confirmation exists yet.

## Historical voice correction and source preparation

On October 19 the owner rejected the Samantha review narration, paused YouTube upload and delegated American male Higgsfield voice selection. The 104-second Grady film was then completed and locally checked on October 20. The owner subsequently resumed delivery and the film became public; the earlier pause is historical. See [upload packet](UPLOAD.md) and [delivery status](DELIVERY_STATUS.md).

## Historical October 21 source preparation

[P10 source reconciliation](../P10_SOURCE_RECONCILIATION.md) recorded fresh dependency installation, typecheck/build, 227 domain/Auth/database, 11 unit, two production browser, nine security HTTP, actual authenticated MCP, nine setup and six export-boundary passes for the isolated source candidate. That exported-folder replay was same-machine evidence, without provider/human/clean-machine acceptance. At that preparation boundary, upload was still paused and public source/video delivery remained future work. Later published source/video and the saved Devpost technical draft supersede that state; final personal declarations and submission remain with the owner.
