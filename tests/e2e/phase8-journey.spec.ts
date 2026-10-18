import { expect,test,type Page } from '@playwright/test';
import { testHousehold } from '../helpers';
import type { FixtureName } from '../../packages/contracts/phase0';

async function openPreparedSample(page:Page,fixture:FixtureName){
 const household=await testHousehold(fixture);
 await page.context().addCookies([
  {name:'denlumi_session',value:household.owner.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'},
  {name:'denlumi_caregiver',value:household.caregiver.token,url:'http://127.0.0.1:3400',httpOnly:true,sameSite:'Strict'},
 ]);
 await page.goto('/');
}

test('fictional owner completes review, acknowledgment, explicit start and confirmed pause in browser',async({page})=>{
 const speechRequests:string[]=[];
 page.on('request',request=>{
  if(['/api/speech','/api/transcription'].includes(new URL(request.url()).pathname))speechRequests.push(request.url());
 });
 await page.goto('/');
 await page.getByRole('checkbox',{name:/I understand the fictional sample/}).check();await page.getByRole('button',{name:'Open sample household'}).click();
 await expect(page.getByRole('navigation',{name:'Household views'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Read update aloud'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Record a check-in'})).toBeDisabled();
 await expect(page.getByText('Speech is not enabled. Typed actions remain available.')).toBeVisible();
 const journey=page.getByRole('region',{name:'Review this fictional case'});
 await expect(journey).toBeVisible();
 await journey.getByRole('button',{name:'Save fictional intake'}).click();
 await expect(journey.getByRole('button',{name:'Create draft for owner review'})).toBeEnabled();
 await journey.getByRole('button',{name:'Create draft for owner review'}).click();
 await expect(journey.getByRole('checkbox',{name:'I reviewed this exact fictional revision.'})).toBeVisible();
 await journey.getByRole('checkbox',{name:'I reviewed this exact fictional revision.'}).check();
 await journey.getByRole('button',{name:'Record owner review'}).click();
 await expect(journey.getByRole('button',{name:'Acknowledge exact handover'})).toBeVisible();
 await journey.getByRole('button',{name:'Acknowledge exact handover'}).click();
 await journey.getByRole('button',{name:'Sam acknowledges exact handover'}).click();
 await expect(journey.getByRole('button',{name:'Sam acknowledged this version'})).toBeDisabled();
 await journey.getByRole('button',{name:'Check session preflight'}).click();
 await expect(journey.getByText('Ready for an explicit human start. This is a fictional software session.')).toBeVisible();
 await journey.getByRole('button',{name:'Start fictional software session'}).click();
 await expect(journey.getByText('Session · active')).toBeVisible();
 await journey.getByLabel('Exact fictional report').fill('Fictional report: Finn moved toward Nora; exact meaning requires clarification.');
 await journey.getByLabel('Observed pet').selectOption({label:'Finn (dog)'});
 await journey.getByLabel('Directed toward').selectOption({label:'Nora (cat)'});
 await journey.getByLabel('Report meaning').selectOption('affirmed');
 await journey.getByRole('button',{name:'Save exact draft'}).click();
 await expect(journey.getByText('Draft awaiting your review:')).toBeVisible();
 await journey.getByRole('button',{name:'Confirm this exact fictional report and pause guidance'}).click();
 await expect(page.getByRole('heading',{name:'Guidance is paused.'})).toBeVisible();
 await page.getByRole('button',{name:'Check Sam’s saved view'}).click();
 await expect(page.getByText('Sam’s saved view was refused.')).toBeVisible();
 await page.getByRole('button',{name:'New conversation'}).click();
 await page.getByRole('button',{name:'Read current plan'}).click();
 await expect(page.getByText(/The fictional plan for .* is paused/)).toBeVisible();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'History'}).click();
 await expect(page.getByRole('heading',{name:'Private records'})).toBeVisible();
 await page.getByRole('button',{name:'Prepare private preview'}).click();
 await expect(page.getByLabel('Exact file content')).toContainText('Fictional report: Finn moved toward Nora');
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
 expect(speechRequests).toEqual([]);
});

for(const sample of [
 {fixture:'cat_dog_new_cat',scenario:'SC05',actor:'Nora (cat)',target:'Finn (dog)'},
 {fixture:'cat_cat',scenario:'SC03',actor:'Milo (cat)',target:'Nora (cat)'},
 {fixture:'dog_dog',scenario:'SC04',actor:'Rory (dog)',target:'Finn (dog)'},
 {fixture:'single_cat',scenario:'SC01',actor:'Nora (cat)',target:null},
 {fixture:'single_dog',scenario:'SC02',actor:'Finn (dog)',target:null},
])test(`${sample.scenario}: full fictional browser handover, report, pause, stale refusal and private preview`,async({page})=>{
 await openPreparedSample(page,sample.fixture as FixtureName);
 const journey=page.getByRole('region',{name:'Review this fictional case'});
 await expect(journey.getByText(sample.scenario,{exact:true})).toBeVisible();
 await journey.getByRole('button',{name:'Save fictional intake'}).click();
 await journey.getByRole('button',{name:'Create draft for owner review'}).click();
 await journey.getByRole('checkbox',{name:'I reviewed this exact fictional revision.'}).check();
 await journey.getByRole('button',{name:'Record owner review'}).click();
 await journey.getByRole('button',{name:'Acknowledge exact handover'}).click();
 await journey.getByRole('button',{name:'Sam acknowledges exact handover'}).click();
 await journey.getByRole('button',{name:'Check session preflight'}).click();
 await expect(journey.getByText('Ready for an explicit human start. This is a fictional software session.')).toBeVisible();
 await journey.getByRole('button',{name:'Start fictional software session'}).click();
 await expect(journey.getByText('Session · active')).toBeVisible();
 if(!sample.target){
  await expect(page.getByText('A complete household of one. No second pet needed.')).toBeVisible();
  await expect(journey.getByLabel('Directed toward').locator('option')).toHaveCount(1);
 }
 const report=sample.target?`Fictional ${sample.scenario} report: ${sample.actor} moved toward ${sample.target}; meaning remains a caregiver report.`:`Fictional ${sample.scenario} report: one pet was observed; no second pet or target was reported.`;
 await journey.getByLabel('Exact fictional report').fill(report);
 await journey.getByLabel('Observed pet').selectOption({label:sample.actor});
 if(sample.target)await journey.getByLabel('Directed toward').selectOption({label:sample.target});
 await journey.getByLabel('Report meaning').selectOption(sample.target?'affirmed':'uncertain');
 await journey.getByRole('button',{name:'Save exact draft'}).click();
 await expect(journey.getByText('Draft awaiting your review:')).toBeVisible();
 if(!sample.target)await expect(journey.getByText('Target: none/unknown',{exact:false})).toBeVisible();
 await journey.getByRole('button',{name:'Confirm this exact fictional report and pause guidance'}).click();
 await expect(page.getByRole('heading',{name:'Guidance is paused.'})).toBeVisible();
 await page.getByRole('button',{name:'Check Sam’s saved view'}).click();
 await expect(page.getByText('Sam’s saved view was refused.')).toBeVisible();
 await page.getByRole('button',{name:'New conversation'}).click();
 await page.getByRole('button',{name:'Read current plan'}).click();
 await expect(page.getByText(/The fictional plan for .* is paused/)).toBeVisible();
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'History'}).click();
 await expect(page.getByRole('heading',{name:'History'})).toBeVisible();
 await expect(page.getByText(report)).toBeVisible();
 await page.getByRole('button',{name:'Prepare private preview'}).click();
 await expect(page.getByLabel('Exact file content')).toContainText(report);
 if(!sample.target)await expect(page.getByText('Pets:',{exact:false}).filter({hasText:sample.fixture==='single_cat'?'Nora':'Finn'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
});

test('SC07 multi-pet coordination never offers a group session',async({page})=>{
 await openPreparedSample(page,'multi_pet');
 const journey=page.getByRole('region',{name:'Review this fictional case'});
 await expect(journey.getByText('SC07',{exact:true})).toBeVisible();
 await expect(journey.getByText('This route supports coordination only or requires clarification/help.')).toBeVisible();
 await expect(journey.getByRole('button',{name:'Create draft for owner review'})).toBeDisabled();
 await expect(journey.getByRole('button',{name:'Start fictional software session'})).toHaveCount(0);
 await page.getByRole('navigation',{name:'Household views'}).getByRole('button',{name:'Pets'}).click();
 await expect(page.getByText('Separate pair contexts (3)')).toBeVisible();
 await expect(page.getByRole('button',{name:'Stop guidance'})).toBeVisible();
});
