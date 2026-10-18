import { z } from 'zod';
export const uuid = z.uuid();
export const stateInput = z.object({ case_id: uuid, expected_safety_epoch: z.number().int().nonnegative(), plan_revision_id: uuid, home_version: z.number().int().positive(), protocol_version_id: uuid }).strict();
export const observationInput = stateInput.extend({ raw_report: z.string().trim().min(1).max(1500), actor_pet_id: uuid.nullable(), target_pet_id: uuid.nullable(), assertion: z.enum(['affirmed','negated','uncertain']), source_kind: z.enum(['typed','structured','voice']), observed_at: z.iso.datetime({ offset: true }).nullable() }).strict();
export const pauseInput = stateInput.extend({ reason: z.string().trim().min(1).max(300) }).strict();
export const confirmInput = stateInput.extend({ observation_id: uuid, digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type StateInput = z.infer<typeof stateInput>;
export type ObservationInput = z.infer<typeof observationInput>;
export const fixtureNames = ['cat_dog','cat_dog_new_cat','cat_cat','dog_dog','single_cat','single_dog','multi_pet'] as const;
export type FixtureName = typeof fixtureNames[number];
export type Brief = {
  household_id: string; case_id: string; nickname: string; title: string; role: string;
  mode: 'demo'; fictional: true; as_of: string; safety_epoch: number; home_version: number;
  support_level: string; plan_revision_id: string; plan_status: string; current_step: string;
  protocol_version_id: string; protocol_slug: string; protocol_status: string; pairing: string;
  source_ids: string[]; guidance_available: boolean; stale: boolean; physical_state_verified: false;
  pets: { id: string; nickname: string; aliases?:string[]; species: string; role: string }[];
  handovers: { id: string; body: {schema_version:string;summary:string;physical_state_verified:false}; safety_epoch: number; created_at: string }[];
  observations: { id: string; raw_report: string; actor_pet_id: string|null; target_pet_id: string|null; assertion: string; status: string; observed_at: string|null; reported_at: string; source_kind: string; digest: string; reporter_id: string }[];
  holds: { policy_level: string; reason: string }[];
};
export function bindState(b: Brief): StateInput { return { case_id:b.case_id, expected_safety_epoch:b.safety_epoch, plan_revision_id:b.plan_revision_id, home_version:b.home_version, protocol_version_id:b.protocol_version_id }; }
