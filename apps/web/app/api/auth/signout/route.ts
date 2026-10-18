import { authClient } from '../../../../../../packages/domain/auth';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { DomainError } from '../../../../../../packages/domain/db';
import { guard,cookie,error,json,sessionCookie } from '../../../../lib/http';
export async function POST(req:Request) {
 try{
  // Logout is same-origin and token-bound, and must remain retryable after revocation.
  // The Auth service validates each token; there is no caller-supplied user/session ID.
  guard(req,true);
  for(const name of ['denlumi_session','denlumi_caregiver']){
   const token=cookie(req,name);if(token){const r=await authClient().auth.admin.signOut(token,'local');if(r.error&&!isAuthSessionMissingError(r.error)&&![401,403,404].includes(r.error.status??0))throw new DomainError('SIGNOUT_NOT_CONFIRMED',503);}
  }
  const res=json({signed_out:true});
  for(const name of ['denlumi_session','denlumi_caregiver'])res.headers.append('Set-Cookie',sessionCookie(name,'').replace('Max-Age=3600','Max-Age=0'));
  return res;
 }catch(e){return error(e);}
}
