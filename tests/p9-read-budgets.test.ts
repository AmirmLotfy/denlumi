import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { testHousehold,testIdentity } from './helpers';
import { pool } from '../packages/domain/db';
import { rateLimit } from '../apps/web/lib/http';
import { householdActor } from '../apps/web/lib/household-http';
import { GET as index } from '../apps/web/app/api/households/route';
import { GET as brief } from '../apps/web/app/api/households/[id]/route';
import { GET as graph } from '../apps/web/app/api/households/[id]/graph/route';
import { GET as planning } from '../apps/web/app/api/households/[id]/planning/route';
import { GET as memberships } from '../apps/web/app/api/households/[id]/memberships/route';
import { GET as rules } from '../apps/web/app/api/households/[id]/routine-rules/route';
import { GET as occurrences } from '../apps/web/app/api/households/[id]/routine-occurrences/route';
import { GET as inbox } from '../apps/web/app/api/households/[id]/inbox/route';
import { GET as caseContext } from '../apps/web/app/api/cases/[id]/context/route';
import { GET as caregiverBrief } from '../apps/web/app/api/caregiver/route';
import { GET as caregiverPlanning } from '../apps/web/app/api/caregiver/planning/route';

after(async()=>{await pool.end();});
function request(token:string,mode:'cookie'|'bearer'='cookie',method='GET'){
 const origin=process.env.APP_ORIGIN!;
 return new Request(origin+'/api/households',{method,headers:{Host:new URL(origin).host,Origin:origin,
  ...(mode==='cookie'?{Cookie:`denlumi_session=${token}`}:{Authorization:`Bearer ${token}`})}});
}
function readers(id:string){
 const context={params:Promise.resolve({id})};
 return [
  (req:Request)=>index(req),(req:Request)=>brief(req,context),(req:Request)=>graph(req,context),
  (req:Request)=>planning(req,context),(req:Request)=>memberships(req,context),(req:Request)=>rules(req,context),
  (req:Request)=>occurrences(req,context),(req:Request)=>inbox(req,context)
 ];
}
test('mixed household GET routes share one read budget while writes retain their budget',async()=>{
 const home=await testHousehold(),readersForHome=readers(home.householdId);
 const key=`household:${home.owner.actor.userId}:read`;
 for(let n=0;n<120-readersForHome.length;n++)rateLimit(key,120);
 for(const read of readersForHome)assert.equal((await read(request(home.owner.token))).status,200);
 for(const read of readersForHome){
  const response=await read(request(home.owner.token));
  assert.equal(response.status,429);assert.deepEqual(await response.json(),{error:'RATE_LIMITED'});
 }
 assert.equal((await householdActor(request(home.owner.token,'cookie','POST'))).userId,home.owner.actor.userId);
});

test('exhausting consequential writes does not spend the household read budget',async()=>{
 const user=await testIdentity();
 for(let n=0;n<30;n++)rateLimit(`household:${user.actor.userId}:write`,30);
 await assert.rejects(()=>householdActor(request(user.token,'cookie','POST')),{code:'RATE_LIMITED'});
 assert.equal((await index(request(user.token))).status,200);
});

test('household reads preserve bearer support, cookie-only routes and cookie precedence',async()=>{
 const home=await testHousehold(),readersForHome=readers(home.householdId);
 for(const read of readersForHome.slice(0,5))assert.equal((await read(request(home.owner.token,'bearer'))).status,200);
 for(const read of readersForHome.slice(5))assert.equal((await read(request(home.owner.token,'bearer'))).status,401);
 const invalidCookie=request(home.owner.token,'bearer');invalidCookie.headers.set('Cookie','denlumi_session=invalid');
 assert.equal((await readersForHome[2](invalidCookie)).status,401);
});

test('case and dedicated caregiver reads share the actor budget without widening cookie access',async()=>{
 const home=await testHousehold();
 for(let n=0;n<118;n++)rateLimit(`household:${home.caregiver.actor.userId}:read`,120);
 const dedicated=()=>{
  const input=new Request(request(home.caregiver.token).url+`?household_id=${home.householdId}`,request(home.caregiver.token));
  input.headers.set('Cookie',`denlumi_caregiver=${home.caregiver.token}`);return input;
 };
 assert.equal((await caseContext(request(home.caregiver.token,'bearer'),{params:Promise.resolve({id:home.caseId})})).status,200);
 assert.equal((await caregiverBrief(dedicated())).status,200);
 const limited=await caregiverPlanning(dedicated());
 assert.equal(limited.status,429);assert.deepEqual(await limited.json(),{error:'RATE_LIMITED'});
 for(const read of [caregiverBrief,caregiverPlanning]){
  assert.equal((await read(request(home.caregiver.token,'bearer'))).status,401);
  assert.equal((await read(request(home.owner.token))).status,401);
 }
});
