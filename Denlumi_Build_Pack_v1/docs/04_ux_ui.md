# 04 - UX, interface, and brand system

## Visual thesis
A practical, welcoming household notebook with the clarity of a good care checklist. Light mode first. Not a veterinary dashboard, baby app, collectible game, or AI chat clone.

Primary design move: **a shared plan with distinct pet lanes**. Names and species accompany every status; colors are decorative identifiers, not welfare judgments. A relationship detail is a two-pet sheet with the context and latest observation, not a force-directed graph users must decipher.

## Tokens
Canvas `#F6F8F5`; surface `#FFFFFF`; ink `#1D2B2A`; secondary text `#536560`; action evergreen `#205B4D`; action-hover `#17483D`; decorative lime `#DCEB98`; border `#D8E1DA`; focus/interactive-outline `#5D776A`; informational blue `#245B85`; amber text `#7A4B00`; pause/danger text `#9F302F`.

Lime is never small text on white. Subtle borders do not carry essential control boundaries. State labels include text and an icon. Use danger sparingly for stopping/risk information, not pet identities. No gradients, glassmorphism, purple AI glows, paw-print wallpaper, or decorative chat bubbles.

Typography: Plus Jakarta Sans for interface and display; Noto Sans Arabic as a later locale counterpart after license/version verification. Self-host licensed assets during implementation; do not ship font binaries in this specification pack. Body 16 px, supporting text at least 14 px, practical session instruction 24-28 px, desktop hero 48-64 px. Do not alternate fonts within a headline.

Spacing: 4/8/12/16/24/32/48/64. Cards radius 16 px, controls 12 px, dialogs 20 px. Buttons 48 px minimum height; pause in a session at least 56 px with ample separation. Illustrations must be informative, anatomically plausible and non-anthropomorphic. Pet photographs are optional; use initials/species labels as a complete fallback.

## Research notes
These references informed component choices, not copied visual designs:
- [Fi pet health screen](https://mobbin.com/screens/89958f60-b292-4cd5-8bca-69b2370f22f8): clear pet-specific title, tabs, and labeled categories. Do not copy sensor collection, health inferences, or the rank navigation.
- [MyFitnessPal activity screen](https://mobbin.com/screens/cce4bcc1-9837-4d8e-ac21-5c8e0b24fd9b): useful separation of current activity from subsequent items. Denlumi must reject countdown-led automatic advancement.
- [Forest breathing screen](https://mobbin.com/screens/c6485d4b-493d-440e-847e-6b3ba1176d45): demonstrates the benefit of focusing attention on one instruction; reject the low-salience exit, countdown emphasis, and dark blurred style for Denlumi.

The original screens are research references. No Mobbin images are redistributed in this pack and they are not implementation assets.

## Information architecture
Mobile bottom navigation: Today, Pets, Home, History. Ask Denlumi is a contextual action on relevant screens, not the central navigation item. Cases are accessible from Today and relevant pets. Account, household, permissions, and help live under the profile control. Desktop uses a 224 px sidebar and a content width up to 1180 px.

## Screen inventory
| Screen | Core content and primary action |
|---|---|
| Marketing home | Product promise, actual demo preview, sample CTA |
| Sample picker | Cat-cat, dog-dog, cat-dog fictional cases; explicit simulation status |
| Sign-in | Email link/passkey-provider option where supported; no forced social login |
| Household setup | Nickname, time zone, owner consent |
| Pet setup | Species confirmation, nickname, optional age/photo, unknown choices |
| Situation picker | Arrival, sharing home, routine, changed situation, sitter, concern |
| Intake | Applicable questions one short group per page; saved draft |
| Support result | Guided/coordination/professional route with plain reason |
| Today | Latest handover, current plan, assigned tasks, last sync status |
| Home | Zones/resources with list fallback and last reported arrangement |
| Pair/context detail | Two pets, case context, reported history, open questions |
| Plan review | Sources/review status, current prerequisites, owner review action |
| Session preflight | Current pets/context, acknowledgment, network and protocol checks |
| Active session | One instruction, two pet observation controls, prominent pause |
| Observation review | What was heard, who did what, certainty, confirm/correct |
| Paused session | Reason, what synchronized, appropriate next action |
| Handover | Exact plan change and acknowledgment by each authorized caregiver |
| Routines | Task owner, planned time, reported history, uncertainty/conflict |
| Concern view | Reviewed help route, record/export options; no upgrade overlay |
| History | Attributed events and corrections, not a pet happiness chart |
| Professional summary | Editable factual summary, uncertainty, sharing preview |
| Invite/share | Scope, identity, expiry, revocation, exact content |
| Settings | Notifications, privacy, exports, membership, deletion |
| Content admin | Draft/review/version/revoke; visible reviewer identity |

## Active-session layout
Top: pet names, pairing, context, online status. Middle: current reviewed instruction and a small 'Why this step' disclosure. Lower: record for each named pet; optional push-to-talk. Bottom: a persistent Stop session control and a separate Pause control only if testing proves that distinction is understandable. R0 may use one 'Stop guidance' action to reduce ambiguity.

Do not force eyes onto the screen while handling animals. Voice response must be short and interruptible. Disable autoplay videos, alerts, pet sounds, and completion fanfares during sessions. A 'sound off' mode is complete.

## Microcopy
Say: 'Reported by Maya at 08:10'; 'Needs clarification'; 'This update has not reached the other caregiver yet'; 'The plan has changed. Read the update before starting'; 'A separate routine can be a good outcome'.
Never say: 'They are safe together'; '90% compatible'; 'Your dog is jealous'; 'Best friends in 7 days'; 'You failed today's session'; 'Vet-approved' without the actual scoped review record.

## Accessibility and localization
Target WCAG 2.2 AA [S17], with 48 px touch controls as our design choice, not the literal AA minimum. Test keyboard navigation, screen-reader labels, contrast, 200% zoom, reduced motion, pointer-only alternatives to dragging, visible focus, and text equivalents for audio. Session status updates use appropriate live regions without interrupting every action.

English R0; i18n keys from day one. Store timestamps in UTC with household IANA timezone. Later Arabic needs RTL layout, mirrored directional navigation, tested pet-name pronunciation, and separately reviewed safety content. Do not translate safety instructions dynamically at runtime. A household can use typed names without relying on speech pronunciation.
