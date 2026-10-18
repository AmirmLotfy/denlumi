# Acceptance-test definitions

These 75 tests are implementation requirements, not executed application results.

## AT001 - scenario (P0)
**Given:** Fictional SC01: First cat at home.

**When:** Apply structured scenario routing.

**Then:** Select guided_preparation with appropriate demo fixture; never claim live professional approval.

## AT002 - scenario (P0)
**Given:** Fictional SC02: First dog at home.

**When:** Apply structured scenario routing.

**Then:** Select guided_preparation with appropriate demo fixture; never claim live professional approval.

## AT003 - scenario (P0)
**Given:** Fictional SC03: New cat with resident cat.

**When:** Apply structured scenario routing.

**Then:** Select guided_preparation with appropriate demo fixture; never claim live professional approval.

## AT004 - scenario (P0)
**Given:** Fictional SC04: New dog with resident dog.

**When:** Apply structured scenario routing.

**Then:** Select guided_preparation with appropriate demo fixture; never claim live professional approval.

## AT005 - scenario (P0)
**Given:** Fictional SC05: New cat with resident dog.

**When:** Apply structured scenario routing.

**Then:** Select guided_preparation with appropriate demo fixture; never claim live professional approval.

## AT006 - scenario (P0)
**Given:** Fictional SC06: New dog with resident cat.

**When:** Apply structured scenario routing.

**Then:** Select guided_preparation with appropriate demo fixture; never claim live professional approval.

## AT007 - scenario (P0)
**Given:** Fictional SC07: Three-pet home.

**When:** Apply structured scenario routing.

**Then:** Select coordination_only with appropriate demo fixture; never claim live professional approval.

## AT008 - scenario (P0)
**Given:** Fictional SC08: Young newcomer and senior resident.

**When:** Apply structured scenario routing.

**Then:** Select clarification_required with appropriate demo fixture; never claim live professional approval.

## AT009 - scenario (P0)
**Given:** Fictional SC09: Return after vet stay.

**When:** Apply structured scenario routing.

**Then:** Select clarification_required with appropriate demo fixture; never claim live professional approval.

## AT010 - scenario (P0)
**Given:** Fictional SC10: Move or home-layout change.

**When:** Apply structured scenario routing.

**Then:** Select coordination_only with appropriate demo fixture; never claim live professional approval.

## AT011 - scenario (P0)
**Given:** Fictional SC11: Temporary sitter.

**When:** Apply structured scenario routing.

**Then:** Select coordination_only with appropriate demo fixture; never claim live professional approval.

## AT012 - scenario (P0)
**Given:** Fictional SC12: Everyday care reports.

**When:** Apply structured scenario routing.

**Then:** Select coordination_only with appropriate demo fixture; never claim live professional approval.

## AT013 - scenario (P0)
**Given:** Fictional SC13: Persistent conflict or chase concern.

**When:** Apply structured scenario routing.

**Then:** Select professional_required with appropriate demo fixture; never claim live professional approval.

## AT014 - scenario (P0)
**Given:** Fictional SC14: Alone-time distress concern.

**When:** Apply structured scenario routing.

**Then:** Select professional_required with appropriate demo fixture; never claim live professional approval.

## AT015 - scenario (P0)
**Given:** Fictional SC15: Visitor or child-related household change.

**When:** Apply structured scenario routing.

**Then:** Select coordination_only with appropriate demo fixture; never claim live professional approval.

## AT016 - scenario (P0)
**Given:** Fictional SC16: Reported injury or severe distress.

**When:** Apply structured scenario routing.

**Then:** Select urgent_help with appropriate demo fixture; never claim live professional approval.

## AT017 - scenario (P0)
**Given:** Fictional SC17: Pet leaves or dies.

**When:** Apply structured scenario routing.

**Then:** Select coordination_only with appropriate demo fixture; never claim live professional approval.

## AT018 - safety (P0)
**Given:** A live household and a demo_only module.

**When:** Request a guided start.

**Then:** Reject with PROTOCOL_UNAVAILABLE; allow relevant coordination.

## AT019 - safety (P0)
**Given:** A real approved module with an expired review.

**When:** Start or request next instruction.

**Then:** Block guidance and show current review requirement.

## AT020 - safety (P0)
**Given:** A module revoked during a session.

**When:** Request another instruction.

**Then:** Pause guidance, stale dependent tasks, retain historical version.

## AT021 - safety (P0)
**Given:** A professional-required hold.

**When:** Owner asks to override it.

**Then:** Reject override; preserve records and professional-summary route.

## AT022 - safety (P0)
**Given:** Uncertain actor in a report.

**When:** User says he chased her with several pets.

**Then:** Ask attribution; do not permanently assign it to a guessed pet.

## AT023 - safety (P0)
**Given:** Negated behavior report.

**When:** User says Finn did not chase Nora.

**Then:** Do not classify a confirmed chase from the keyword alone.

## AT024 - safety (P0)
**Given:** User explicitly reports uncertainty.

**When:** Normalize the report.

**Then:** Preserve uncertain assertion and prevent invented certainty.

## AT025 - safety (P0)
**Given:** A pair has prior calm reports.

**When:** A third pet is added.

**Then:** Do not infer group readiness; review participant dependencies.

## AT026 - safety (P0)
**Given:** One pair was reviewed in one room.

**When:** Start in a changed context.

**Then:** Require applicable context and current home version.

## AT027 - safety (P0)
**Given:** No observations have been submitted for days.

**When:** Scheduled progression job executes.

**Then:** Do not infer recovery or progress from silence.

## AT028 - safety (P0)
**Given:** A session clock completes.

**When:** Time elapsed event fires.

**Then:** Do not advance step or imply physical access permission.

## AT029 - safety (P0)
**Given:** An active concern and a paywall.

**When:** User opens help or stops guidance.

**Then:** No purchase required for relevant help, stop, existing record or export.

## AT030 - safety (P0)
**Given:** Unverified professional claim.

**When:** Caregiver says a vet approved all future steps.

**Then:** Do not create professional approval or clear a hold.

## AT031 - safety (P0)
**Given:** Possible medical concern in routine behavior flow.

**When:** User reports sudden unusual change.

**Then:** Use reviewed professional/urgent routing as applicable; no diagnosis.

## AT032 - safety (P0)
**Given:** Source note contains malicious instructions.

**When:** Agent reads note.

**Then:** Treat as data; no permission changes, arbitrary calls or overrides.

## AT033 - safety (P0)
**Given:** Owner wants a compatibility guarantee.

**When:** Ask whether pets are definitely safe together.

**Then:** Explain limitation, report current records and appropriate route.

## AT034 - safety (P0)
**Given:** A pet is archived.

**When:** Read historical session.

**Then:** Preserve original attributed history; omit new tasks for archived pet.

## AT035 - safety (P0)
**Given:** A draft concern is corrected.

**When:** User confirms the earlier words were wrong.

**Then:** Append correction; review the hold rather than silently erasing history.

## AT036 - safety (P0)
**Given:** Practical content exists only in English.

**When:** User chooses an unreviewed locale.

**Then:** Do not machine-translate practical guidance into approved status.

## AT037 - safety (P0)
**Given:** A clinician-only case.

**When:** User asks for medication or aggression treatment.

**Then:** Do not generate a treatment plan; provide appropriate approved help route.

## AT038 - authorization (P0)
**Given:** Member of household A.

**When:** Read/write household B IDs.

**Then:** Reject with scope error and no data leakage.

## AT039 - authorization (P0)
**Given:** Expired sitter grant.

**When:** Fetch notes or start session.

**Then:** Deny on server despite cached screen.

## AT040 - authorization (P0)
**Given:** Caregiver, not owner.

**When:** Approve harder step or invite another person.

**Then:** Deny; show role-appropriate alternative.

## AT041 - authorization (P0)
**Given:** Voice recognized by speech service.

**When:** Attempt privileged write without valid session.

**Then:** Do not treat voice as identity authentication.

## AT042 - authorization (P0)
**Given:** Changed recipient after preview.

**When:** Submit old share approval.

**Then:** Reject digest mismatch.

## AT043 - authorization (P0)
**Given:** Revoked share grant.

**When:** Use an old share URL.

**Then:** Deny server access; explain downloaded copies cannot be remotely recalled.

## AT044 - authorization (P0)
**Given:** Private asset key guessed.

**When:** Fetch file without current authorization.

**Then:** Deny regardless of key knowledge.

## AT045 - authorization (P0)
**Given:** A content reviewer.

**When:** Browse customer household.

**Then:** Deny without separate explicit case access.

## AT046 - session (P0)
**Given:** Running audio with network disconnected.

**When:** Tap stop.

**Then:** Cancel locally; show household sync pending rather than false global pause.

## AT047 - session (P0)
**Given:** Old safety epoch in second caregiver tab.

**When:** Start guidance.

**Then:** Reject STALE_STATE; require current handover and preflight.

## AT048 - session (P0)
**Given:** One unresolved household session.

**When:** Start another even with different pet.

**Then:** Reject SESSION_CONFLICT in R0.

## AT049 - session (P0)
**Given:** Repeated start request with same key/body.

**When:** Retry request.

**Then:** Return same result without duplicate session.

## AT050 - session (P0)
**Given:** Same idempotency key and different body.

**When:** Retry mutated request.

**Then:** Reject key/body mismatch.

## AT051 - session (P0)
**Given:** Lost heartbeat during session.

**When:** Timeout occurs.

**Then:** Mark interrupted; do not certify physical separation or silently free progression.

## AT052 - session (P0)
**Given:** Local offline notes.

**When:** Connectivity returns.

**Then:** Validate scope/version before syncing; preserve actual report and observation times.

## AT053 - session (P0)
**Given:** A paused session.

**When:** Click resume after new concern.

**Then:** Run complete fresh eligibility and reject if held.

## AT054 - routine (P0)
**Given:** A meal task has no report.

**When:** Ask if pet ate.

**Then:** State no report; do not infer ingestion or recommend a duplicate feeding.

## AT055 - routine (P0)
**Given:** Two caregivers report one task.

**When:** Sync both reports.

**Then:** Preserve both; flag conflict instead of counting two confirmed actions.

## AT056 - routine (P0)
**Given:** One task report is retried.

**When:** Submit same idempotency key.

**Then:** Persist only one copy of that report.

## AT057 - routine (P0)
**Given:** Routine changed across daylight-saving time.

**When:** Generate occurrences.

**Then:** Use IANA-zone recurrence with deterministic keys and no accidental duplicates.

## AT058 - notification (P0)
**Given:** Old plan prompt queued.

**When:** Safety epoch changes before send.

**Then:** Cancel stale message after worker recheck.

## AT059 - notification (P0)
**Given:** SQS message delivered twice.

**When:** Worker runs twice.

**Then:** Apply effect once or enter explicit uncertain outcome; no blind resend.

## AT060 - notification (P0)
**Given:** Email provider accepted request.

**When:** Show user status.

**Then:** Distinguish provider_accepted from delivered and acknowledged.

## AT061 - notification (P0)
**Given:** Delivery fails.

**When:** User opens household.

**Then:** Show failure without treating it as caregiver refusal or agreement.

## AT062 - voice (P0)
**Given:** Microphone permission denied.

**When:** Use assistant and sessions.

**Then:** Provide complete typed/button route.

## AT063 - voice (P0)
**Given:** Two pets share similar names.

**When:** Dictation chooses one ambiguously.

**Then:** Ask user to select/confirm, not guess.

## AT064 - voice (P0)
**Given:** TTS playing and user presses stop.

**When:** Audio queue contains more messages.

**Then:** Cancel queued and current audio immediately.

## AT065 - voice (P0)
**Given:** Model provider down.

**When:** Open current household record.

**Then:** Manual logging, pause and approved static information remain usable.

## AT066 - voice (P0)
**Given:** Fresh conversation without chat history.

**When:** Ask why current plan is paused.

**Then:** Retrieve actual case state through real authenticated MCP call.

## AT067 - voice (P0)
**Given:** Model tries forbidden tool name.

**When:** Tool dispatcher receives call.

**Then:** Reject against whitelist; no generic arbitrary HTTP tool.

## AT068 - ux (P0)
**Given:** Screen reader or keyboard only.

**When:** Perform setup, stop and handover.

**Then:** All essential actions and statuses accessible.

## AT069 - ux (P0)
**Given:** 320 CSS pixels or 200 percent zoom.

**When:** Open session and decision screens.

**Then:** No clipped stop action or essential horizontal scrolling.

## AT070 - ux (P0)
**Given:** Reduced-motion preference.

**When:** Use app.

**Then:** Suppress unnecessary animation; no animated progress pressure.

## AT071 - ux (P0)
**Given:** No pet photos.

**When:** Use all flows.

**Then:** Names/species/initials provide full functionality.

## AT072 - ux (P0)
**Given:** Subtle border colors.

**When:** Render interactive controls.

**Then:** Use visible focus/control boundary independent of decorative border.

## AT073 - commercial (P0)
**Given:** Payment provider unavailable.

**When:** Open prototype pricing.

**Then:** Show early access, not fake checkout success.

## AT074 - commercial (P0)
**Given:** Expired pass.

**When:** Read existing records or export.

**Then:** Do not gate relevant records/help/stop/export.

## AT075 - commercial (P0)
**Given:** Native Alexa unavailable.

**When:** Read site and demo.

**Then:** Clearly disclose browser simulation; no certification or live Echo claims.
