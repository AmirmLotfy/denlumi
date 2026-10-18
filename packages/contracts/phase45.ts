import { z } from 'zod';
import { stateInput } from './phase0';
import { expectedHousehold } from './household';
const uuid=z.string().uuid(),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const sessionStartInput=stateInput.extend({handover_id:uuid,handover_digest:hash}).strict();
export const sessionActionInput=z.object({expected_safety_epoch:z.number().int().nonnegative(),expected_state:z.enum(['active','paused','interrupted'])}).strict();
export const sessionPauseInput=sessionActionInput.extend({reason:z.string().trim().min(1).max(500)}).strict();
export const sessionObservationInput=sessionActionInput.extend({raw_report:z.string().trim().min(1).max(1500),actor_pet_id:uuid.nullable(),target_pet_id:uuid.nullable(),assertion:z.enum(['affirmed','negated','uncertain']),source_kind:z.enum(['typed','structured','voice']),observed_at:z.iso.datetime({offset:true}).nullable(),reported_at:z.iso.datetime({offset:true}).nullable(),behavior_code:z.string().trim().max(120).nullable(),normalized_observation:z.object({schema_version:z.literal('1'),values:z.record(z.string(),z.unknown()),unknowns:z.array(z.string().trim().min(1).max(120)).max(100)}).strict()}).strict();
export const sessionConfirmInput=sessionActionInput.extend({observation_id:uuid,digest:hash}).strict();
export const observationCorrectionInput=sessionActionInput.extend({observation_id:uuid,original_digest:hash,raw_report:z.string().trim().min(1).max(1500),actor_pet_id:uuid.nullable(),target_pet_id:uuid.nullable(),assertion:z.enum(['affirmed','negated','uncertain']),source_kind:z.enum(['typed','structured','voice']),observed_at:z.iso.datetime({offset:true}).nullable(),reported_at:z.iso.datetime({offset:true}).nullable(),correction_reason:z.string().trim().min(1).max(500)}).strict();

export const routineSchedule=z.object({schema_version:z.literal('1'),timezone:z.string().min(1).max(100),frequency:z.enum(['daily','weekly']),local_time:z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),days_of_week:z.array(z.number().int().min(0).max(6)).max(7).default([]),dst_policy:z.literal('wall_clock_first_valid').default('wall_clock_first_valid')}).strict().refine(v=>v.frequency==='daily'||v.days_of_week.length>0,'weekly schedule requires days');
export const routineInput=expectedHousehold.extend({pet_id:uuid,kind:z.enum(['meal','water','walk','litter','rest','enrichment','other_nonmedical']),instruction:z.string().trim().min(1).max(1000),schedule_spec:routineSchedule}).strict();
export const routineUpdateInput=routineInput.extend({expected_rule_version:z.number().int().positive(),status:z.enum(['active','paused','archived'])}).strict();
export const occurrenceGenerationInput=expectedHousehold.extend({from_date:z.iso.date(),through_date:z.iso.date()}).strict().refine(v=>v.through_date>=v.from_date,'invalid date range');
export const taskClaimInput=z.object({expected_state:z.enum(['planned','claimed'])}).strict();
export const taskReportInput=z.object({report:z.enum(['done','skipped','uncertain']),performed_at:z.iso.datetime({offset:true}).nullable(),note:z.string().max(1000).nullable()}).strict();
export const taskCorrectionInput=z.object({report:z.literal('correction'),supersedes_id:uuid,corrected_report:z.enum(['done','skipped','uncertain']),performed_at:z.iso.datetime({offset:true}).nullable(),note:z.string().trim().min(1).max(1000)}).strict();
