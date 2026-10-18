# 03 - Scenario coverage and welfare policy

## What 'all cat and dog scenarios' means in this product
The software supports every species pairing and routes common shared-home scenarios. It does not claim to diagnose or safely treat every animal problem. Coverage may mean guided preparation, shared coordination, or a professional-help path. These are intentionally different outcomes.

| ID | Scenario | Primary route | Distinct requirement | Release |
|---|---|---|---|---|
| SC01 | First cat in a pet-free home | Guided settling + routine coordination | No pair required; individual retreat/resources | R0 demo; reviewed R1 |
| SC02 | First dog in a pet-free home | Guided settling + routine coordination | Dog-specific home/routine intake | R0 demo; reviewed R1 |
| SC03 | New cat with resident cat(s) | Cat-cat introduction | Separate directional observations and resource access | R0 demo; reviewed R1 |
| SC04 | New dog with resident dog(s) | Dog-dog introduction | Appropriate handler/environment prerequisites | R0 demo; reviewed R1 |
| SC05 | New cat with resident dog(s) | Mixed introduction: newcomer cat | Cat retreat/access and dog history reviewed | R0 demo; reviewed R1 |
| SC06 | New dog with resident cat(s) | Mixed introduction: newcomer dog | Preserve resident-cat access and new-dog context | R0 demo; reviewed R1 |
| SC07 | Three or more pets, mixed or same species | Household graph + separate pair contexts | Pair outcomes do not establish group safety | R0 coordination; reviewed pair guidance |
| SC08 | Puppy/kitten with adult or senior pet | Age/context modifier | Health and developmental suitability need review | R0 route; relevant approved R1 module |
| SC09 | Reunion after absence, boarding, or vet stay | Reintroduction review | New medical/recovery concerns block generic progression | R0 coordination; reviewed R1 |
| SC10 | Move, renovation, room change | Home-plan revision | Invalidate affected context and resource assumptions | R0 coordination; reviewed R1 module |
| SC11 | Sitter, foster handover, new caregiver | Scoped shared handover | Pet-specific permissions and expiration | R0 |
| SC12 | Everyday multi-pet care | Routine coordination | Reports are not proof of eating or treatment | R0 |
| SC13 | Persistent conflict, guarding, chase concern | Pause + professional review | No automated aggression or predation treatment | R0 routing |
| SC14 | Alone-time distress or noise concern | Preparation/logging + professional route | No flooding, deprivation, 'cry it out', or severity diagnosis | R0 routing; later reviewed education |
| SC15 | Visitors, children, changed human household | Adult-managed coordination | No child-led sessions or child-safety certification | R0 routing; later reviewed education |
| SC16 | Injury, severe distress, suspected illness | Reviewed urgent-help route | No training task before relevant help information | R0 routing |
| SC17 | Pet leaves household or dies | Sensitive archive and routine revision | Preserve records; no automatic replacement-pet advice | R1 coordination |

R0 presence in the menu is not a claim that a professional has approved practical animal-handling instructions. Demo fixtures cannot be silently published into customer mode.

## Why species-specific routing matters
Feline guidance emphasizes individual resources, gradual introductions, and subtle tension [S4, S5]. Dog guidance includes handler/environment considerations and may require professional help after significant conflict [S6]. Mixed-species guidance recognizes that some dogs and cats cannot safely live together [S7]. Therefore a single universal stage sequence is inappropriate.

Use reward-based methods only; AVSAB's published position supports that policy [S8]. Sudden behavioral change may reflect pain or other health issues, so a routine behavior workflow must not treat it as ordinary training non-compliance [S9].

The numbered examples below are product safety policies proposed for expert review, not a veterinary treatment protocol.

## Support levels
- `guided_preparation`: an approved low-risk preparation or session module is applicable and its prerequisites are current. This is not a diagnosis of low animal risk.
- `coordination_only`: tasks, record keeping, resource planning, and professional summaries; no exposure/progression guidance.
- `clarification_required`: input or context is insufficient; suppress new guidance until resolved.
- `professional_required`: relevant guided progression stays locked. General care coordination remains available.
- `urgent_help`: interrupt coaching and display reviewed localizable help content. Do not claim a comprehensive triage service or guarantee detection of all emergencies.

## Red lines
No predicted compatibility score. No breed blacklist or breed-based safety assurance. No photo/video emotion detector. No 'alpha', dominance enforcement, punishment, forced interaction, shock/prong advice, deliberate triggering, deprivation, or letting animals fight. No timers that open access to another animal. No camera, collar, device, or speaker action that could startle or physically control pets. No recommendation to leave animals unsupervised based on app progress.

## Stop, pause, and synchronization
`Stop` first cancels audio and stops local guidance without any network call. Then the client submits an idempotent pause to the server. If offline, show 'Stopped on this device. Household update not yet synchronized.' Do not show global confirmation until committed. Do not resume guidance offline. Typed/button pause must work when speech recognition does not.

The household has a monotonic `safety_epoch`. A relevant new hold increments it and invalidates dependent reviews, tasks, and sessions. Workers verify it at send time. A session also binds `plan_revision_id`, `home_version`, and `protocol_version_id`.

An interrupted connection does not prove the real-world interaction ended. Mark the session interrupted, preserve a household review requirement, and require fresh human confirmation before any new guided session. A timeout may expire software locks only through this interrupted-state transition; it never silently declares the environment safe.

## Progression policy
No elapsed-time progression, streak-based progression, average-of-pets score, inferred recovery from silence, or treating eating a treat as proof of comfort. A candidate next step requires complete structured observations, the applicable approved module, current prerequisites, no hold, and owner review. The owner can choose less interaction; the app must not nudge more contact as the only success.

All active case participants must be considered. Evidence about a pair does not imply a three-pet group's readiness. R0 permits only one guided introduction session per household, simplifying conflicts involving shared zones, pets, and caregivers.

## Corrections and uncertain reports
'He did not chase her' is not a positive chase report. 'I think he was staring' preserves uncertainty. Pronoun ambiguity requires attribution before a permanent classified event. A possible concern may trigger a temporary clarification pause; only confirmed/appropriately reviewed information creates a persistent case policy outcome. Preserve the original report and any correction. A correction must not silently clear a professional-required hold.

## Professional-required re-entry
R0 does not have an override button. An owner cannot click 'I spoke to a vet' to unlock a prohibited module. In a future professional workflow, a verified case-specific review can authorize an eligible revised plan; it is not a blanket declaration that pets are compatible. Treatment beyond the product's scope remains outside it.

## Knowledge freshness
A revoked protocol immediately blocks new starts and further guided instructions. A currently displayed session falls back to a reviewed pause message. Store original protocol version for the record; do not rewrite history. Locale-specific review is mandatory before translated practical guidance is activated.
