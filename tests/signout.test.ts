import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../apps/web/app/api/auth/signout/route';
import {authenticateToken} from '../packages/domain/auth';
import {pool} from '../packages/domain/db';
import {testIdentity} from './helpers';
after(()=>pool.end());
const origin='http://127.0.0.1:3400';
function logout(owner?:string,caregiver?:string,from=origin){return POST(new Request(origin+'/api/auth/signout',{method:'POST',headers:{Host:'127.0.0.1:3400',Origin:from,Cookie:[owner?`denlumi_session=${owner}`:'',caregiver?`denlumi_caregiver=${caregiver}`:''].filter(Boolean).join('; ')}}));}
function cleared(response:Response){const cookies=response.headers.getSetCookie();for(const name of ['denlumi_session','denlumi_caregiver'])assert.ok(cookies.some(c=>c.startsWith(name+'=;')&&c.includes('Max-Age=0')&&c.includes('HttpOnly')&&c.includes('SameSite=Strict')));}
test('same-origin logout revokes both supplied sessions, preserves another identity and safely retries absent or invalid cookies',async()=>{
 const owner=await testIdentity(),caregiver=await testIdentity(),other=await testIdentity();
 const csrf=await logout(owner.token,caregiver.token,'http://example.invalid');assert.equal(csrf.status,403);
 await authenticateToken(owner.token);
 const response=await logout(owner.token,caregiver.token);assert.equal(response.status,200);cleared(response);
 await assert.rejects(authenticateToken(owner.token),{code:'UNAUTHORIZED'});
 await assert.rejects(authenticateToken(caregiver.token),{code:'UNAUTHORIZED'});
 await authenticateToken(other.token);
 for(const retry of [await logout(owner.token,caregiver.token),await logout(),await logout('malformed-token','malformed-token')]){assert.equal(retry.status,200);cleared(retry);}
});
test('partial logout retains an honest failure and retries caregiver revocation after owner session is already gone',async()=>{
 const owner=await testIdentity(),caregiver=await testIdentity();const original=globalThis.fetch;
 try{
  globalThis.fetch=async(input,init)=>{
   const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));
   if(String(input instanceof Request?input.url:input).includes('/auth/v1/logout')&&headers.get('authorization')===`Bearer ${caregiver.token}`)return Response.json({message:'Fictional Auth outage',code:'unexpected_failure'},{status:503});
   return original(input,init);
  };
  const failed=await logout(owner.token,caregiver.token);assert.equal(failed.status,503);assert.equal((await failed.json()).error,'SIGNOUT_NOT_CONFIRMED');assert.equal(failed.headers.getSetCookie().length,0);
 }finally{globalThis.fetch=original;}
 await assert.rejects(authenticateToken(owner.token),{code:'UNAUTHORIZED'});await authenticateToken(caregiver.token);
 const retried=await logout(owner.token,caregiver.token);assert.equal(retried.status,200);cleared(retried);
 await assert.rejects(authenticateToken(caregiver.token),{code:'UNAUTHORIZED'});
});
