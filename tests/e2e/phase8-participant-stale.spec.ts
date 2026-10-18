import { randomUUID } from 'node:crypto';
import { expect,test } from '@playwright/test';
import { testHousehold } from '../helpers';
import { addPet,householdGraph } from '../../packages/domain/household';
import { getBrief } from '../../packages/domain/state';
import { planningWorkspace } from '../../packages/domain/planning';
import { bindState } from '../../packages/contracts/phase0';

test('a third participant supersedes the acknowledged two-pet handover and refuses stale caregiver work',async({page})=>{
 const home=await testHousehold('cat_dog');
 const initial=await householdGraph(home.owner.actor,home.householdId);
 await addPet(home.owner.actor,home.householdId,{expected_state_version:initial.household.state_version,expected_safety_epoch:initial.household.safety_epoch,nickname:'Milo',species:'cat',age_band:null,approx_birth_date:null,arrival_date:null,context_notes:{schema_version:1,reported_history:null,accessibility_notes:null},aliases:[]},randomUUID());
 const third=(await householdGraph(home.owner.actor,home.householdId)).pets.find(p=>p.nickname==='Milo');expect(third).toBeTruthy();
 await page.context().addCookies([
  {name:'denlumi_session',value:home.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'},
  {name:'denlumi_caregiver',value:home.caregiver.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'},
 ]);
 await page.goto('/');
 const journey=page.getByRole('region',{name:'Review this fictional case'});
 await journey.getByRole('button',{name:'Save fictional intake'}).click();
 await journey.getByRole('button',{name:'Create draft for owner review'}).click();
 await journey.getByRole('checkbox',{name:'I reviewed this exact fictional revision.'}).check();
 await journey.getByRole('button',{name:'Record owner review'}).click();
 await journey.getByRole('button',{name:'Acknowledge exact handover'}).click();
 await journey.getByRole('button',{name:'Sam acknowledges exact handover'}).click();
 await expect(journey.getByRole('button',{name:'Sam acknowledged this version'})).toBeDisabled();
 const before=await getBrief(home.caregiver.actor,home.householdId),oldState=bindState(before);
 const workspace=await planningWorkspace(home.owner.actor,home.householdId);
 const oldHandover=workspace.handovers.find(h=>h.case_id===home.caseId&&h.plan_revision_id===before.plan_revision_id&&h.status==='published');expect(oldHandover).toBeTruthy();
 const graph=await householdGraph(home.owner.actor,home.householdId);
 const changed=await page.request.post(`/api/cases/${home.caseId}/participants`,{headers:{Origin:'http://127.0.0.1:3400','Idempotency-Key':randomUUID()},data:{expected_state_version:graph.household.state_version,expected_safety_epoch:graph.household.safety_epoch,pet_id:third!.id,role:'affected',context_key:'home'}});
 expect(changed.status()).toBe(200);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Plan review needed.'})).toBeVisible();
 await expect(journey.getByText('Current route: clarification required. Revisit the fictional intake to create a fresh safety version.')).toBeVisible();
 await expect(journey.getByText(/Latest: Revision .* stale/)).toBeVisible();
 await expect(journey.getByRole('button',{name:'Create draft for owner review'})).toBeDisabled();
 await expect(journey.getByRole('button',{name:'Start fictional software session'})).toHaveCount(0);
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Pets'}).click();
 await expect(page.getByText('Separate pair contexts (3)')).toBeVisible();
 await page.getByText('Separate pair contexts (3)').click();
 await expect(page.getByText('no group-readiness inference')).toHaveCount(3);
 const headers={Origin:'http://127.0.0.1:3400','Idempotency-Key':randomUUID()};
 const stale=await page.request.post('/api/actions',{headers,data:{operation:'preflight',input:oldState,caregiver:true}});
 expect(stale.status()).toBe(409);expect((await stale.json()).error).toBe('STALE_STATE');
 const oldAck=await page.request.post('/api/caregiver/acknowledge',{headers:{...headers,'Idempotency-Key':randomUUID()},data:{handover_id:oldHandover!.id,acknowledged_digest:oldHandover!.digest}});
 expect(oldAck.status()).toBe(409);expect((await oldAck.json()).error).toBe('HANDOVER_CHANGED');
 const start=await page.request.post('/api/sessions',{headers:{...headers,'Idempotency-Key':randomUUID()},data:{...oldState,handover_id:oldHandover!.id,handover_digest:oldHandover!.digest}});
 expect(start.status()).toBe(409);expect((await start.json()).error).toBe('STALE_STATE');
 const after=await planningWorkspace(home.owner.actor,home.householdId);
 expect(after.handovers.find(h=>h.id===oldHandover!.id)?.status).toBe('superseded');
 expect(after.own_acknowledgements.some(a=>a.handover_id===oldHandover!.id)).toBe(true);
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
});
