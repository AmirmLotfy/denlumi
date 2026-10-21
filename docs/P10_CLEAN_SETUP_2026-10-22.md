# P10 fresh setup and presentation alignment — October 22, 2026

The owner authorized remaining technical submission fixes, clean local setup verification and the existing showcase update, then requested an original 3:2 Devpost cover, useful links and more real screenshots. Personal identity/eligibility/rights declarations and final submission remain owner-manual. The owner separately confirmed Yes with documented limitations for Feedback Question 5; no qualifying additional open-source contribution was supplied, so that challenge remains No.

## Actual fresh setup

A new anonymous clone of GitHub commit `9ad14228bd9adf1d2a3d6608154146759c9f962e` installed its own dependencies with `npm ci`, using Node 22.23.4/npm 10.9.9. The original localhost native stack was stopped while preserving its data. A new private runtime home downloaded native service archives and created its own database/Auth and credentials. No old database, environment file, private status adapter or private application wrapper was used.

This exposed a real distributed setup defect: Supabase CLI 2.121.0's experimental runtime rejects `status -o json`. The public helper now uses `stack status --output-format json` under the documented experimental flag and reports failures with CLI output withheld. Two new setup regressions failed before the repair, then all eleven passed. The fixed public helper created mode-0600 configuration and the seed command installed seven fictional demo_only protocols. See [judge setup](JUDGE_SETUP.md).

The same fresh environment passed typecheck, production build, **227/227 domain/Auth/database**, **60/60 typed-browser**, **5/5 isolated mocked voice**, **11/11 unit**, **11/11 setup** and **7/7 export** checks, authenticated HTTP MCP, nine HTTP security checks, a 15-browser-asset selected-secret scan and a zero-known-vulnerability lockfile audit. The JPEG export regression first failed, then passed after the allowlist preserved JPEG bytes instead of omitting or interpreting them as UTF-8. Exact execution records and hashes are in [redacted setup evidence](../evidence/phase10/clean-setup-2026-10-22.json).

This is a fresh clone, service download, credentials file and database on the **same Apple Silicon Mac**, using existing Chrome 155.0.8059.85. It does not establish independent-machine, Linux or fresh-browser installation acceptance. Application source and the repaired helper/export scripts were byte-compared with the current working source; later presentation/document changes do not change executed application behavior.

## Docker result and resource boundary

An isolated, newly created Colima Docker 29.5.2 VM failed during legacy database initialization. The image store returned I/O errors and the kernel reported vdb write failures and an aborted EXT4 journal under host storage pressure. This is **not a successful Docker replay** or an established application/Supabase defect. The failed task-owned VM/data were removed; other projects, original native data and global Docker selection were preserved. Idle task-owned dependency/build/download caches were removed only after ownership/open-file checks. No unrelated cleanup was performed.

## Public presentation and source changes

The existing [showcase](https://denlumi-showcase.vercel.app/#product) now serves the exact 104-second Grady film, matching WebVTT/transcript and a real film-frame poster, with the [public YouTube film](https://www.youtube.com/watch?v=cbWwUAx-EMU) linked. Native controls remain user-operated. The film already contains English captions, so the optional selectable track no longer forces a duplicate overlay. Six anonymous public files matched local bytes and MP4 range delivery returned 206. Muted browser playback advanced; this is not human listening. [Deployment evidence](../evidence/phase10/showcase-update-2026-10-22.json).

The original [3:2 cover](submission/assets/denlumi-devpost-thumbnail.png) is conceptual brand art generated through the built-in image tool, with no exposed model identifier. It was saved as the Devpost thumbnail. [Prompt/provenance](submission/assets/THUMBNAIL_PROVENANCE.md) and [real screenshot inventory](submission/screenshots/README.md) distinguish artwork from actual application captures. No generated UI or provider success is presented as a screenshot.

The original untracked workspace and retained dirty historical publication checkout stay preserved. The sanitized release candidate, current GitHub source, source ZIP and Devpost factual material must be reconciled before handoff; [delivery status](submission/DELIVERY_STATUS.md) records actual external outcomes.

## Remaining acceptance gates

Docker, old-record/full-platform recovery, human H01–H08, microphone/listening, provider cost/latency/retention, qualified exact-version practical content review and owner legal/eligibility declarations are not accepted by these software checks. Bedrock was historically refused; current authorization remains unknown after expired identity. No new AWS request or hosted Supabase resource was used. All practical modules remain demo_only.
