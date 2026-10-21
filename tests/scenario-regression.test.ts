import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../packages/domain/db';
import { testIdentity } from './helpers';
import { addPet, createCase, createHousehold, householdGraph } from '../packages/domain/household';
import { routeCase } from '../packages/domain/planning';

after(() => pool.end());
const expected = async (actor: any, id: string) => {
 const graph = await householdGraph(actor, id);
 return { expected_state_version: graph.household.state_version, expected_safety_epoch: graph.household.safety_epoch };
};
async function setup(code: string, species: ('cat' | 'dog')[], roles?: string[]) {
 const owner = await testIdentity();
 const home = await createHousehold(owner.actor, { nickname: 'Fictional scenario regression', timezone: 'Africa/Cairo',
  locale: 'en', adult_acknowledged: true, notification_preferences: { internal_inbox: true, email: false } }, randomUUID());
 for (const [index, kind] of species.entries()) {
  await addPet(owner.actor, home.household_id, { ...await expected(owner.actor, home.household_id), nickname: `Pet ${index + 1}`, species: kind }, randomUUID());
 }
 const graph = await householdGraph(owner.actor, home.household_id);
 const result: any = await createCase(owner.actor, home.household_id, { ...await expected(owner.actor, home.household_id),
  title: 'Fictional applicability check', scenario_code: code,
  participants: graph.pets.map((pet, i) => ({ pet_id: pet.id, role: roles?.[i] ?? 'affected' })) }, randomUUID());
 return { owner, homeId: home.household_id, caseId: result.value.id };
}
const variants: [string, ('cat' | 'dog')[], string][] = [
 ['SC07', ['dog', 'dog', 'dog'], 'coordination_only'],
 ['SC07', ['cat', 'cat', 'cat'], 'coordination_only'],
 ['SC07', ['cat', 'dog', 'cat', 'dog', 'cat', 'dog'], 'coordination_only'],
 ['SC08', ['cat', 'cat'], 'clarification_required'],
 ['SC08', ['cat', 'dog'], 'clarification_required'],
 ['SC09', ['dog', 'dog'], 'clarification_required'],
 ['SC10', ['cat'], 'coordination_only'],
 ['SC11', ['cat'], 'coordination_only'],
 ['SC12', ['cat', 'cat'], 'coordination_only'],
 ['SC13', ['cat', 'cat'], 'professional_required'],
 ['SC14', ['cat'], 'professional_required'],
 ['SC15', ['cat', 'dog'], 'coordination_only'],
 ['SC16', ['dog'], 'urgent_help'],
];
for (const [code, species, level] of variants) {
 test(`${code} accepts applicable ${species.join('-')} records without inventing practical approval`, async () => {
  const t = await setup(code, species);
  const routed: any = await routeCase(t.owner.actor, t.caseId, { ...await expected(t.owner.actor, t.homeId),
   intake_schema_version: '1', answers: {}, unknowns: [] }, randomUUID());
  assert.equal(routed.value.support_level, level);
  assert.equal(routed.value.physical_state_verified, false);
 });
}
for (const [code, species, roles, error] of [
 ['SC01', ['dog'], ['newcomer'], 'SCENARIO_PARTICIPANT_MISMATCH'],
 ['SC07', ['cat', 'dog'], ['affected', 'affected'], 'SCENARIO_PARTICIPANT_MISMATCH'],
 ['SC08', ['cat'], ['affected'], 'SCENARIO_PARTICIPANT_MISMATCH'],
 ['SC05', ['cat', 'dog'], ['resident', 'newcomer'], 'NEWCOMER_DIRECTION_MISMATCH'],
] as const) {
 test(`${code} retains its structural boundary: ${error}`, async () => {
  const t = await setup(code, [...species], [...roles]);
  await assert.rejects(routeCase(t.owner.actor, t.caseId, { ...await expected(t.owner.actor, t.homeId),
   intake_schema_version: '1', answers: {}, unknowns: [] }, randomUUID()), (e: any) => e.code === error);
 });
}
