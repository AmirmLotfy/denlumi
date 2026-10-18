import { z } from 'zod';
import { authClient,tokenActor } from '../../../../../packages/domain/auth';
import { provisionDemo } from '../../../../../packages/content/fixtures';
import { pool,DomainError } from '../../../../../packages/domain/db';
import { demoRetentionNotice } from '../../../../../packages/domain/records';
import { fixtureNames } from '../../../../../packages/contracts/phase0';
import { guard,body,error,json,sessionCookie,rateLimit } from '../../../lib/http';
export async function POST(req:Request) {
 try{
  guard(req,true);rateLimit('demo-entry',12);
  if(process.env.DENLUMI_DEMO_ENABLED!=='true'||!['127.0.0.1','localhost'].includes(new URL(process.env.APP_ORIGIN!).hostname))throw new DomainError('DEMO_DISABLED',403);
  const {fixture}=z.object({fixture:z.enum(fixtureNames),retention_acknowledged:z.literal(true)}).strict().parse(await body(req));
  const owner=await authClient().auth.signInAnonymously(),caregiver=await authClient().auth.signInAnonymously();
  if(owner.error||caregiver.error||!owner.data.session||!caregiver.data.session)throw new DomainError('AUTH_PROVIDER_UNAVAILABLE',503);
  const tenant=await provisionDemo(tokenActor(owner.data.session.access_token,owner.data.user!.id),fixture,true);
  await pool.query("insert into memberships(household_id,profile_id,role,accepted_at) values($1,$2,'caregiver',now())",[tenant.householdId,caregiver.data.user!.id]);
  const res=json({...tenant,authentication:'Supabase Auth anonymous fictional users',retention_notice:demoRetentionNotice});
  res.headers.append('Set-Cookie',sessionCookie('denlumi_session',owner.data.session.access_token));
  res.headers.append('Set-Cookie',sessionCookie('denlumi_caregiver',caregiver.data.session.access_token));
  return res;
 }catch(e){return error(e);}
}
