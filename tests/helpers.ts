import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { authClient,tokenActor } from '../packages/domain/auth';
import { provisionDemo } from '../packages/content/fixtures';
import { pool } from '../packages/domain/db';
import type { FixtureName } from '../packages/contracts/phase0';
export async function testIdentity() {
 if(!process.env.SUPABASE_URL?.startsWith('http://127.0.0.1:55431'))throw new Error('Tests require isolated local Supabase');
 const email=`test-${randomUUID()}@denlumi.invalid`,password=randomUUID()+randomUUID();
 const admin=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(created.error)throw created.error;
 const login=await authClient().auth.signInWithPassword({email,password});
 if(login.error||!login.data.session)throw login.error??new Error('No session');
 const token=login.data.session.access_token;
 return {token,actor:tokenActor(token,login.data.user!.id),admin,email,password};
}
export async function testHousehold(fixture:FixtureName='cat_dog',retentionAcknowledged=false) {
 const owner=await testIdentity(),caregiver=await testIdentity();
 const tenant=await provisionDemo(owner.actor,fixture,retentionAcknowledged);
 await pool.query("insert into memberships(household_id,profile_id,role,accepted_at) values($1,$2,'caregiver',now())",[tenant.householdId,caregiver.actor.userId]);
 return {owner,caregiver,...tenant};
}
