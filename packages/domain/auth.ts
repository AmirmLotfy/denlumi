import { createClient } from '@supabase/supabase-js';
import { pool, DomainError, type Actor } from './db';
export function authClient(token?:string) {
 const target=new URL(process.env.SUPABASE_URL!);
 if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='55431'||target.protocol!=='http:')throw new DomainError('LOCAL_SUPABASE_REQUIRED',503);
 return createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:token?{headers:{Authorization:`Bearer ${token}`}}:undefined});
}
export function tokenActor(token:string,userId:string):Actor {
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
 if(typeof claims.session_id!=='string')throw new DomainError('UNAUTHORIZED',401);
 return {userId,sessionId:claims.session_id};
}
export async function authenticateToken(token:string):Promise<Actor> {
 const {data,error}=await authClient().auth.getUser(token);
 if(error||!data.user)throw new DomainError('UNAUTHORIZED',401);
 const actor=tokenActor(token,data.user.id);
 const s=await pool.query("select 1 from auth.sessions s join public.profiles p on p.id=s.user_id where s.id=$1 and s.user_id=$2 and p.status='active' and (s.not_after is null or s.not_after>now())",[actor.sessionId,actor.userId]);
 if(!s.rowCount)throw new DomainError('UNAUTHORIZED',401);
 return actor;
}
