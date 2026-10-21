# Submission readiness — 2026-10-21 Africa/Cairo

> Delivery resumed by the owner on October 21, 2026. The preparation-only upload pause below is historical; current progress and unresolved form/terms gates are in [delivery status](DELIVERY_STATUS.md). This does not assert a completed upload or submitted entry.

**Status: P10 preparation is reviewable; publication/submission remain open and YouTube upload stays paused.** Current local P9 evidence is 227 domain/Auth/database, 60 typed-browser and five synthetic/mocked voice passes. The historical public repository lacks later local work. The 1:44 Grady/SVG film and captions are in the [review/upload packet](UPLOAD.md); the site's 2:03 Samantha video is historical. Follow the ordered [next-step and gate packet](NEXT_STEPS.md). No replacement upload, site update or event submission occurred in this preparation.

## Deadline and current rule changes

Refreshed October 21 Cairo (October 20 UTC) from the readable official [overview](https://amazonappdev2026.devpost.com/), [rules](https://amazonappdev2026.devpost.com/rules), [FAQ](https://amazonappdev2026.devpost.com/details/faqs), [final-stretch update](https://amazonappdev2026.devpost.com/updates/46539-final-stretch) and [feedback guidance](https://amazonappdev2026.devpost.com/updates/46538-strong-submission-tips). This does not verify the owner's registration, actual form or declarations.

The [official overview](https://amazonappdev2026.devpost.com/) lists **Friday, October 23, 2026 at 12:00 PDT**. That is **19:00 UTC / 22:00 Africa/Cairo on October 23**, with Cairo at UTC+3. Conversion was checked using Python `zoneinfo` for `America/Los_Angeles` and `Africa/Cairo`, not a fixed year-round offset. A prudent owner target is October 22 at 22:00 Cairo; this earlier target is our recommendation, not the official deadline.

The rules retain a September 16 repository update allowing private GitHub source shared with reviewers. The latest final-stretch checklist mentions public source only; the rules, overview and FAQ still expressly allow either route. The chosen public MIT route avoids that wording discrepancy. The Alexa+ simulation route needs neither a specific framework nor an MCP-shaped surface; Denlumi implements actual local HTTP MCP. The FAQ explicitly accepts a locally runnable public repository plus video without hosting or continuously running MCP. Supabase remains local-only.

Judging access must remain free through November 20, 12:00 Pacific = 20:00 UTC = 22:00 Cairo (UTC+2). The final-stretch update separately asks entrants to freeze repository, video and project materials after the deadline until the scheduled December 3 winner announcement. Do not confuse the access minimum with permission to change submitted materials.

## Deliverable checklist

The [overview submission requirements](https://amazonappdev2026.devpost.com/) require source/setup access, description, a public YouTube/Vimeo demo under three minutes, tool feedback and track selection. A public website is not required. English materials are required or must have English translations. The [updates page](https://amazonappdev2026.devpost.com/updates) emphasizes specific feedback, including onboarding and whether the entrant would use each tool again.

| Item | Current evidence / next action | State |
|---|---|---|
| Project description | [Copy draft](../../devpost-submission.md); owner editorial check remains | Drafted |
| Video | [Checked 1:44 Grady/SVG film, captions and upload packet](UPLOAD.md); human review and resumed YouTube/Vimeo publication still required | Local checks passed; upload paused |
| GitHub source and instructions | https://github.com/AmirmLotfy/denlumi remains at October 18 `ae32fcb8cdd8f45996615bdf9c9addd357eb0805`; later local work not fully published | Historical publication; parity open |
| Reviewer delivery choice | Public licensed source selected under the owner's delivery request; no collaborator invitations needed | Public source |
| Clean portable source package | Retained allowlisted snapshot is historical; prepare/review current sanitized diff locally before any authorized publication | Current refresh/review open |
| Judge run instructions | [Judge setup](../JUDGE_SETUP.md); October 19 isolated native replay passed, while a separate clean-machine/Docker replay is unverified | Native evidence; other replay open |
| Working demo replay | P9 227/227 domain/Auth/database, 60/60 typed-browser, 5/5 mocked-voice; real local HTTP/MCP checks. October 19 recording predates final P9 pins | Current local software evidence; historical recording |
| Feedback | [Tool feedback and reproducible friction](PRODUCT_FEEDBACK.md); owner confirms personal recommendation fields | Drafted |
| Primary track | Alexa+ simulation recommended; owner has not selected/submitted the form here | Pending owner |
| Mini-challenges | AWS Builder conditional choice; Open Source unselected, no contribution link verified | Pending owner |
| Eligibility, rights and team representation | Owner verifies against current rules and confirms authority/asset rights; no legal agreement accepted | Open |
| Public link verification and final submission | Verify actual video/repo links and reviewer access; owner submits before deadline | Open |

For private GitHub access, the refreshed rules/FAQ identify five Amazon users: `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`. The old `chris-trag` entry is absent. Confirm the live Devpost contact and instructions before any separately authorized invitation. Invitations expire after seven days and require acceptance. No collaborator was added here. Credentials belong in a private testing channel only, never public copy, source or video.

## How to make the case to judges

The [official judging criteria](https://amazonappdev2026.devpost.com/rules) are equally weighted: implementation, design, impact and idea quality. Optional friction logs can earn up to a 10% bonus; no bonus is guaranteed.

| Criterion | Concrete Denlumi demonstration | Limit to disclose |
|---|---|---|
| Implementation | Real authenticated HTTP MCP, versioned state, stale caregiver refusal, offline Stop | Local simulation; Bedrock inference blocked |
| Design | One connected review → handover → session → report → pause → private preview | Automated browser evidence; human usability open |
| Impact | Specific caregiver coordination failure: another person has an outdated plan | Product hypothesis; no customer or animal outcome claim |
| Idea quality | Current shared state survives conversation boundaries; human actions retain authority | No autonomous handling, supervision or native Alexa claim |

## Engineering and release gaps

The [P9 operations handoff](../P9_OPERATIONS_HANDOFF.md) and [redacted evidence](../../evidence/phase9/operations-2026-10-21.json) now supply the local baseline: **227/227 domain/Auth/database, 60/60 production typed-browser, five synthetic/mocked voice tests**, typecheck/build, seven existing HTTP proofs, nine security HTTP checks and seven fictional pairing shapes passed. Next **16.4.2**, MCP **1.32.1**, React/DOM **19.3.1**, task-local Node **22.23.3** / npm **10.9.9** are the tested pins. The recorded audit reports zero known findings; it does not fully audit Node or bundled code. Recheck the announced October 21 Node security release before release. Software counts are actual coordinator executions in the P9 handoff; document reconciliation adds no human or provider acceptance.

October 19's 110/110 and 29/29 and earlier counts remain historical. Accumulated-old-fixture performance/old-record restoration and clean-machine Docker replay remain unverified; no old fixtures were purged. P9 dry-run cleanup and real app-to-Postgres configuration failure/recovery are not a continuous cleanup operation or backup restoration.

Bedrock inference was refused historically and the latest AWS identity recheck expired; current authorization is **unknown**. Historical real Polly/Transcribe generated-input calls and five mocked-voice tests do not establish current provider access or human microphone/audio acceptance. Human screen-reader/native zoom/supported-device/non-audio/voice and observed fictional usability remain open. Qualified exact-version practical-content approval, policy-reviewed table-by-table retention, continuous consented cleanup, full backup expiry/restore, live provider latency/cost/retention and production-scale/real-operator withdrawal acceptance remain open. No retroactive unconsented-fixture purge is authorized. A fictional simulation submission must not present these as accepted.

Read-only refresh evidence: anonymous GitHub API returned 200 and the exact historical head above; showcase and old MP4 HEAD returned 200, old MP4 length 5,640,915 bytes. The browser research tool could not open those URLs; independent Python HTTPS requests supplied these observations, without downloading remote media. The local Grady film was rehashed at 7,262,243 bytes, SHA-256 `1a8b63b138c151002519302703345e77008034805c8a43dac7f071d5b2f589ca`. Existing [media](../../evidence/phase10/video-natural.json), [playback](../../evidence/phase10/video-film-browser.json) and [sampled-frame](../../evidence/phase10/video-film-visual.json) results are not human listening acceptance. Its October 19 real browser capture predates the final P9 build; no updated recording is claimed.

Supabase remains strictly localhost-only. Judge delivery cannot silently create a hosted Supabase project or authorize remote migrations. A source-and-video route is compatible with the current local-only boundary; choose reproducible local setup and accurate private access instructions.

October 21 local operations added a bounded nine-household withdrawal proof and an isolated current application-schema restore: 75 tables, 32 policies and eight access/session canaries matched. Original service ownership and nine future-object default-privilege entries were not reproduced; full-platform recovery remains open. See [operations handoff](../P9_OPERATIONS_HANDOFF.md). The [human task packet](../P9_HUMAN_ACCEPTANCE.md) starts NOT_RUN, and the [retention worksheet](../PHASE_9_METADATA_RETENTION_PROPOSAL.md) is unapproved. These preparations grant no practical-content, policy, human or production acceptance.

## Smallest next action

Review the ordered [P10 packet](NEXT_STEPS.md). The owner can watch/listen to the exact local 1:44 replacement and record acceptance or timestamped corrections while upload stays paused. Use the current P9 handoff for unresolved acceptance gates and prepare the exact local source reconciliation. Public push/deployment, upload, actual form declarations and final submission remain later owner-controlled actions.


Historical October 19 voice correction: the owner rejected the published review copy's Samantha narration, paused YouTube upload and delegated selection of an American male Higgsfield voice. The replacement was then in progress; October 20's completed local check is recorded above. The old site copy remains historical. See [upload packet](UPLOAD.md).

## October 21 — source candidate prepared, upload paused

Current local reconciliation and exported-folder replay are complete: [P10 source report](../P10_SOURCE_RECONCILIATION.md). Fresh dependency installation, typecheck/build, 227 domain/Auth/database, 11 pure unit, two production browser, nine HTTP security, actual authenticated MCP, nine setup and six export-boundary checks passed. Full P9 60-browser/five-mock results remain separately dated. All practical protocols are demo_only; no provider/human/clean-machine acceptance is added. The isolated candidate, full diff, manifest and allowlisted archive remain local. Original dirty publication checkout and exact film are preserved. Public source, replacement video URL and final form remain open; owner watch/listen, rights/eligibility/build-window/feedback declarations and separately authorized delivery are next. Upload remains paused.
