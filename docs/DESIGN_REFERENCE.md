# Phase 0 design reference lock

Date: 2026-09-16. Scope: one fictional shared-home console and its current-plan, observation/pause, stale-caregiver, and fresh-conversation proof states. This document is a build direction, not evidence that the interface or provider integration has passed QA.

## Brief and authority

Designing a small English web console for adult caregivers who need the same current plan for cats and dogs. The primary job is to see what changed, who reported it, and which household update the current caregiver has read. The tone is practical, direct, and welcoming. The main risk is confusing a reported event, a local software stop, or an old view with a current shared fact.

The user explicitly requested Refero inspiration, no green or purple, and direct implementation. The color lock below supersedes the green/lime palette in `Denlumi_Build_Pack_v1/brand/tokens.json` and the color paragraph in `docs/04_ux_ui.md` for Phase 0. The system-font choice also supersedes bundled-pack font preferences for this phase. The product's welfare, attribution, accessibility, and scope rules remain the source of behavior requirements.

Research was performed through live Refero tools: three style-search angles, three full styles, three full screen records, two screen images inspected in-tool, and one full three-step flow. No screenshot, font binary, private report, or reference image was saved into the repository. Refero access worked; there is no research-tool blocker.

## Reference selection

| Reference | What was inspected | Assigned role |
| --- | --- | --- |
| [Orderful](https://www.orderful.com) — style `9c657624-4aa8-4688-a6be-4eb3d6f2ce57` | Full style after broad precision/neutral-product search | Primary: white and neutral-gray surfaces, strong type, one vivid action color, 8px geometry, comfortable 16/24px internal spacing. |
| [Todoist](https://todoist.com) — style `d9a3223e-d0d5-436b-aa09-0facd1805a1e` | Full style after known-product search | Secondary: readable, generously padded actions and approachable task language. Do not import its peach decorations, large marketing illustrations, alternate fonts, or success-green tokens. |
| [Incident](https://incident.io) — style `3fcc8a86-07e5-4672-a653-756ac3a96750` | Full style after broad precision/neutral-product search | Compared and rejected as a foundation: dense serif text and completely square, minimally padded controls feel too institutional for the household use case. Its orange decorative tokens are not imported as status colors. |
| [Todoist task activity](https://refero.design/pages/7cd91870-20ca-4edb-9828-c08ab4247611) | Full screen record and screenshot | Attributed activity rows: named person, plain action sentence, exact report content, timestamp. Adapt the row anatomy in the page, without reproducing the modal or completion badges. |
| [Missive task detail](https://refero.design/pages/50fbeb1e-2dd2-4e54-a182-4b0a7bda0145) | Full screen record and screenshot | Context and detail remain visible together. Adapt a main shared-plan area with a narrower supporting panel; omit inbox navigation, chat bubbles, and task-stage boards. |
| [Parallel warning dialog](https://refero.design/pages/681dde47-367c-48eb-8e01-4b6676e4a7b7) | Full screen record | Warning hierarchy: specific consequence, short reason, clear action. Use inline for stale/paused state. Do not borrow the modal confirmation or checkbox before Stop. |
| [Runey — Task Detail and Comment](https://refero.design/flows/11691) | Full flow, three steps | Keep the selected context visible while composing; after submit, place the committed report in that same context. This is a UI sequence reference, not evidence of Denlumi persistence or authorization. |

Search angles: (1) crisp neutral utility with restrained vivid action; (2) household/care coordination and checklists; (3) Todoist-focused productivity. The domain search produced largely soft healthcare/cream/serif directions; these were not selected. The final direction intentionally retains Orderful's sharper achromatic structure.

## Locked visual direction

**A clear household handover sheet.** Preserve five primary traits: neutral gray canvas; clean white working surfaces; strong near-black sans-serif hierarchy; a single vermilion CTA accent; consistent 8px corners and flat boundaries. The plan is the visual anchor. Conversation is a compact supporting surface.

The memorable detail is a shared **handover strip**: the current household update appears beside each fictional caregiver's last-read update. A stale reader sees plain text such as “The plan has changed. Read the update before starting.” The strip remains about knowledge and software state; it does not certify animal safety or physical actions.

Borrow only Todoist's comfortable action padding and task-oriented sentence hierarchy at the style layer. Screen references govern attribution rows and the adjacent context/detail arrangement. Do not average the references into a cream, serif, muted-clay aesthetic.

The source Orderful accent is reserved for primary CTA use. Use it for one meaningful action per panel, such as “Save observation” or “Read current update”; never as a positive welfare indicator, pet identity, decoration, gradient, or every panel border. The product's dark-red semantic token is separate and reserved for Stop and paused/risk messaging. Text and icons must disambiguate these roles.

No image asset is required for this console. Actual functional panels are the visual content. Named initials and written species are a complete pet/avatar fallback. Do not add stock pets, device mockups, generated animals, decorative code windows, sound waves, paw wallpaper, badges, or a mascot to fill space.

### Color and shape commitments

| Token | Value | Role |
| --- | --- | --- |
| `canvas` | `#F5F5F5` | Neutral page background; no green tint. |
| `surface` | `#FFFFFF` | Main plan, report form, and supporting panels. |
| `ink` | `#1F1F1F` | Main copy, headings, line icons. |
| `secondary` | `#4A5565` | Supporting text; retains readable contrast. |
| `action` | `#E42B0C` | Primary CTA only, with white text. |
| `actionHover` | `#C6250B` | Same CTA role on hover; no hue switch. |
| `border` | `#D4D4D4` | Nonessential separators and panel boundaries. |
| `controlBorder` | `#787878` | Essential input/control boundaries against white. Not small body text. |
| `focus` | `#1F1F1F` | 2px visible outline with a 3px surface gap. |
| `warningText` / `warningSurface` | `#7A4B00` / `#FFF8E8` | Stale/unknown/sync-pending text with an explicit label. Product semantic role. |
| `danger` / `dangerSurface` | `#9F302F` / `#FFF3F1` | Stop and paused/restricted status. Product semantic role. |
| `confirmedText` / `confirmedSurface` | `#1F1F1F` / `#F5F5F5` | “Saved” or “Current” with a word and optional check icon. No green success state. |
| `radius` | `8px` | Panels, controls, inputs. Initial avatars can be circular. |
| `shadow` | `none` | Base console; reserve a small shadow only for a real overlay. |

Calculated WCAG contrast examples: white/action 4.52:1; secondary/white 7.56:1; danger/dangerSurface 6.58:1; warningText/warningSurface 7.00:1; controlBorder/white 4.42:1. These are token calculations, not a rendered accessibility audit. Do not reduce CTA opacity or apply a lighter tint to its text. Use a visible border and wording for disabled/unavailable actions.

### Typography and spacing

Use `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` throughout. No external font fetch or font binary. This preserves the primary reference's clear sans-serif roles while honoring the Phase 0 asset constraint. Do not imitate custom letterforms or alternate a word into serif/italic/color.

- Page title: 32px desktop / 28px mobile, weight 650–700, line-height 1.15, slight `-0.02em` tracking.
- Current state or plan sentence: 24px, weight 600, line-height 1.3.
- Panel headings: 18–20px, weight 600, line-height 1.35.
- Body and form controls: 16px, line-height 1.5. Supporting labels and timestamps: at least 14px, line-height 1.45.
- Use normal case and tabular numerals for timestamps/update numbers. No wide-tracked tiny all-caps labels.
- Use the existing 4/8/12/16/24/32/48 spacing scale. Panel padding is 24px desktop and 16px mobile. Controls are at least 48px tall; Stop is at least 56px tall.

## One-console layout

At desktop sizes, use a contained working width up to 1180px with a quiet top bar and a main grid of `minmax(0, 1fr) 340px`, separated by 24px. A full application sidebar is unnecessary for Phase 0's single console; do not create inactive roadmap navigation. Keep the selected sample and active fictional caregiver visible in the top control row.

Visual reading order:

1. **Identity and scope:** Denlumi wordmark, “Fictional household demo,” selected household/pairing, fictional caregiver selector. No provider success label from a local-only event.
2. **Named pet lanes:** each real fixture participant gets its name, species, and resident/newcomer role. All cat-cat, dog-dog, and cat-dog samples use the same lane anatomy but their own correct content. A future single-pet record uses one lane with no placeholder companion.
3. **Current plan and handover strip:** state title, short reason, current update label, caregiver read state, and a conspicuous `Demo-only protocol` label. Attributed report content and report/observation time remain separate.
4. **Observation:** a short contextual form beneath the current plan; actor, target where relevant, exact report, assertion/uncertainty, and timing. Show explicit human confirmation only where the implemented contract requires it. Never let a “save” design imply expert approval.
5. **Supporting conversation panel:** labelled “Alexa-style browser simulation.” A short response area, typed input, and an explicit fresh-conversation action. It reads the current shared state through the implemented path. Do not call it native Alexa, certified, connected to a physical device, or supervised.
6. **Persistent Stop:** easily reached and never buried in a disclosure. “Stop guidance” plus concise explanatory text that it stops software. Local and household-sync result messages must be distinct.

On narrow screens, place these sections in that order in one column. The conversation follows the plan/observation instead of pushing them below the fold. Keep the Stop control sticky only if it does not obscure form errors or content; reserve its actual height and safe-area inset. Use a single page scroll, no nested scrolling panel. At 200% zoom and 320px CSS width, controls wrap and text remains available.

Protocol hashes, raw tool results, epochs, request IDs, and transport evidence belong in an optional “Demo evidence” disclosure. User-facing freshness copy should say “Current update,” “Last read,” and “Retrieved at,” with human-readable times. Technical fields do not replace the plain current-state explanation.

## State and journey rules

| State | Required presentation | Action behavior |
| --- | --- | --- |
| Current fictional plan | Same named participants and current update, demo-only content status, attributed records. | Read or record the permitted fixture event. No handling instructions without exact real review. |
| Report being submitted | Keep the draft visible; show a concise pending label. | Avoid duplicate dispatch; never insert a fake committed report. |
| Observation committed with pause | Add the attributed report and changed household update to the same context; make paused reason dominant. | Do not advance the plan, clear a hold, or present “safe together.” |
| Stale caregiver | Inline warning above consequential controls; show which update is current and which they last read. | Route to current update; server rejection remains authoritative. Do not conceal the conflict with a success toast. |
| Fresh conversation | Empty only the conversation's local transcript, with current household context still visible. | Retrieve current state before response. Fresh conversation is not a household reset. |
| Local stop, sync pending | “Stopped on this device. Household update not yet synchronized.” | Stop local software immediately. Retry/sync wording must not claim global completion. |
| Provider/network failure | Specific blocked/failed state in the relevant panel; preserve meaningful user input. | No synthetic reply, green success, or unsupported connected status. |

The Runey sequence supplies the UI continuity pattern: inspect context, compose, submit, see the recorded result in that context. Denlumi adds its own database freshness, attribution, and permission requirements from the product/API specs. Refero screenshots provide no evidence that these requirements are implemented.

## Decision ledger and implementation check

| Decision | Source and preserved role | Reason |
| --- | --- | --- |
| Neutral white/gray surface hierarchy with vermilion CTA | Orderful full style: background/surface/CTA roles | Makes action and current state easy to identify without green, purple, or decorative color. |
| 8px corners, flat grouped panels, 16/24px internal spacing | Orderful full style | Retains its precise structure rather than softening every element into a pill. |
| System sans with 16px body, 14px minimum support | User asset scope; product accessibility rules; sans-serif roles from primary style | Works immediately without shipping fonts and keeps the console readable. |
| Named lanes and three actual pairings | Product brief, scenario/welfare spec, UX spec | Pet identity and pairing are meaningful context, never a score. |
| Handover strip with per-caregiver read state | Product differentiation; handovers/ack data contract | Gives Denlumi a concrete coordination feature and makes stale information visible. |
| Attributed activity rows | Todoist activity screen, visually inspected | Preserves who said what and when without chat-page styling. |
| Main plan plus adjacent supporting surface | Missive task detail, visually inspected | Keeps the shared state visible during the limited conversation proof. |
| Inline consequence-first warning; no Stop confirmation | Parallel warning hierarchy plus product local-stop requirement | The warning explains the restriction without delaying stopping software. |
| No photos, mockups, gradients, completion score, or sound flourish | Product non-goals; source functional-media role; explicit user constraint | Keeps this bounded control surface focused and truthfully fictional. |

Implementation acceptance checks, still pending when this document was written:

- Compare rendered desktop and narrow/mobile views against this lock; fix drift before handoff.
- Verify keyboard order, labels, focus, 200% zoom, and the actual rendered color pairs.
- Show all three fictional pairings with correct participant labels and `demo_only` status.
- Exercise current plan → report/pause → stale caregiver → fresh-conversation read through real implemented calls; capture actual errors and sync state.
- Confirm Stop responds locally without network/model and never implies physical control.
- Confirm no reference screenshot/font asset, green/purple style token, fake provider completion, or unreviewed handling instruction entered the deliverable.

Research-only handoff: this specialist changed only `docs/DESIGN_REFERENCE.md`; no build or runtime test was run. Next smallest task: implement the Phase 0 console using this lock, then perform the rendered and interaction checks above.
