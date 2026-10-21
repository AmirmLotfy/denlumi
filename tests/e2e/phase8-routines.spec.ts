import { randomUUID } from 'node:crypto';
import { expect,test } from './database-test';
import { testHousehold } from '../helpers';
import { householdGraph } from '../../packages/domain/household';
import { createRoutine,generateOccurrences,listDueTasks } from '../../packages/domain/routines';
import { pool } from '../../packages/domain/db';

test('Today records attributed, conflicting fictional routine reports and rejects a foreign caregiver',async({page})=>{
 const home=await testHousehold('single_cat'),foreign=await testHousehold('single_dog');
 const state=async()=>{const graph=await householdGraph(home.owner.actor,home.householdId);return {expected_state_version:graph.household.state_version,expected_safety_epoch:graph.household.safety_epoch};};
 const pet=(await householdGraph(home.owner.actor,home.householdId)).pets[0];
 await createRoutine(home.owner.actor,home.householdId,{...await state(),pet_id:pet.id,kind:'water',instruction:'Fictional owner record: check the water bowl.',schedule_spec:{schema_version:'1',timezone:'Africa/Cairo',frequency:'daily',local_time:'00:01',days_of_week:[],dst_policy:'wall_clock_first_valid'}},randomUUID());
 const date=new Date().toISOString().slice(0,10);
 await generateOccurrences(home.owner.actor,home.householdId,{...await state(),from_date:date,through_date:date},randomUUID());
 const task=(await listDueTasks(home.owner.actor,home.householdId)).tasks[0];
 expect(task).toBeTruthy();
 await page.context().addCookies([{name:'denlumi_session',value:home.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'}]);
 await page.goto('/');
 const form=page.getByRole('form',{name:`Report ${pet.nickname} routine`});
 await expect(form).toBeVisible();
 await form.getByLabel('Caregiver report').selectOption('done');
 await form.getByLabel('Report note').fill('Fictional owner report only.');
 await form.getByRole('button',{name:'Save caregiver report'}).click();
 await expect(page.getByText('Report saved. Current recorded state: reported done. This does not verify physical care.')).toBeVisible();
 await expect(page.getByText('Scheduled state: reported done. 1 attributed report.')).toBeVisible();

 const send=async(token:string,report:'done'|'skipped')=>fetch(`http://127.0.0.1:3400/api/tasks/${task.id}/reports`,{method:'POST',headers:{Origin:'http://127.0.0.1:3400',Cookie:`denlumi_session=${token}`,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({report,performed_at:null,note:'Fictional second report.'})});
 const denied=await send(foreign.owner.token,'skipped');expect(denied.status).toBe(403);expect((await denied.json()).error).toBe('SCOPE_MISMATCH');
 const conflicting=await send(home.caregiver.token,'skipped');expect(conflicting.status).toBe(201);expect((await conflicting.json()).conflict).toBe(true);
 await page.reload();
 await expect(page.getByText('Scheduled state: uncertain. 2 attributed reports.')).toBeVisible();
 await expect(page.getByText('Caregiver report · done ·',{exact:false})).toBeVisible();
 await expect(page.getByText('Caregiver report · skipped ·',{exact:false})).toBeVisible();
 await page.setViewportSize({width:320,height:800});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
 await expect(page.getByRole('form',{name:`Report ${pet.nickname} routine`})).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
});
