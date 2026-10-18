import { PollyClient,SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { z } from 'zod';
import { guard,identity,body,error,rateLimit } from '../../../lib/http';
import { uuid } from '../../../../../packages/contracts/phase0';
import { getBrief } from '../../../../../packages/domain/state';
import { pollyUsage,reserveProvider } from '../../../../../packages/domain/providers';
import { DomainError,pool } from '../../../../../packages/domain/db';
export async function POST(req:Request) {
 try{
  guard(req,true);const {actor}=await identity(req);rateLimit(`speech:${actor.userId}`,20);
  const {household_id}=z.object({household_id:uuid}).strict().parse(await body(req));
  const b=await getBrief(actor,household_id);
  if(process.env.SPEECH_ENABLED!=='true')throw new DomainError('SPEECH_NOT_ENABLED',503);
  const text=`Fictional household demonstration. Update ${b.safety_epoch}. ${b.holds.length?'Software guidance is paused.':'The fictional record is ready to review.'} No practical animal guidance is approved.`;
  const call=await reserveProvider(actor,household_id,'polly',pollyUsage(text));
  const client=new PollyClient({region:process.env.AWS_REGION,maxAttempts:1});
  try{
   const r=await client.send(new SynthesizeSpeechCommand({Text:text,VoiceId:'Joanna',Engine:'standard',OutputFormat:'mp3'}),{abortSignal:AbortSignal.any([req.signal,AbortSignal.timeout(10000)])});
   const bytes=await r.AudioStream?.transformToByteArray();if(!bytes)throw new DomainError('SPEECH_EMPTY_RESPONSE',503);
   await pool.query("update private.provider_calls set outcome='completed',request_id=$2,usage=usage||$3::jsonb where id=$1",[call,r.$metadata.requestId,JSON.stringify({output_audio_bytes:bytes.length})]);
   const fresh=await getBrief(actor,household_id);
   if(fresh.safety_epoch!==b.safety_epoch||fresh.plan_revision_id!==b.plan_revision_id||fresh.home_version!==b.home_version||fresh.protocol_status!==b.protocol_status)throw new DomainError('STALE_STATE');
   return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Denlumi-Source':'Amazon-Polly','X-Denlumi-Epoch':String(b.safety_epoch),'X-Denlumi-Caption':text}});
  }catch(e){await pool.query("update private.provider_calls set outcome='blocked',error_code=$2 where id=$1",[call,e instanceof Error?e.name:'UnknownError']);throw e;}finally{client.destroy();}
 }catch(e){return error(e);}
}
