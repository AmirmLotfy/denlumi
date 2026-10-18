import { TranscribeStreamingClient,StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';
import { guard,identity,error,json,rateLimit } from '../../../lib/http';
import { uuid } from '../../../../../packages/contracts/phase0';
import { MAX_PCM_BYTES,SAMPLE_RATE } from '../../../../../packages/domain/audio';
import { getBrief } from '../../../../../packages/domain/state';
import { reserveProvider,transcribeUsage } from '../../../../../packages/domain/providers';
import { DomainError,pool } from '../../../../../packages/domain/db';

export async function POST(req:Request){
 let bytes:Uint8Array|undefined;
 try{
  guard(req,true);const {actor}=await identity(req);rateLimit(`transcribe:${actor.userId}`,8);
  const id=uuid.parse(req.headers.get('x-denlumi-household'));
  await getBrief(actor,id);
  if(process.env.SPEECH_ENABLED!=='true')throw new DomainError('SPEECH_NOT_ENABLED',503);
  if(req.headers.get('content-type')!=='audio/pcm;rate=16000;channels=1')throw new DomainError('PCM_REQUIRED',415);
  // Read incrementally; an absent or dishonest Content-Length cannot allocate unbounded memory.
  const reader=req.body?.getReader();if(!reader)throw new DomainError('AUDIO_REQUIRED',400);
  const chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>MAX_PCM_BYTES){await reader.cancel();throw new DomainError('AUDIO_TOO_LONG',413);}chunks.push(r.value);}}finally{reader.releaseLock();}
  if(length<3200||length%2)throw new DomainError('INVALID_AUDIO_LENGTH',400);
  bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;chunk.fill(0);}
  const call=await reserveProvider(actor,id,'transcribe',transcribeUsage(length));
  const client=new TranscribeStreamingClient({region:process.env.AWS_REGION,maxAttempts:1});
  const signal=AbortSignal.any([req.signal,AbortSignal.timeout(25000)]);
  try{
   const pcm=bytes;
   const stream=async function*(){for(let i=0;i<pcm.length;i+=3200){signal.throwIfAborted();yield {AudioEvent:{AudioChunk:pcm.slice(i,i+3200)}};await new Promise(r=>setTimeout(r,100));}};
   const result=await client.send(new StartStreamTranscriptionCommand({LanguageCode:'en-US',MediaEncoding:'pcm',MediaSampleRateHertz:SAMPLE_RATE,AudioStream:stream()}),{abortSignal:signal});
   const transcripts=new Map<string,string>();
   for await(const event of result.TranscriptResultStream??[]){for(const r of event.TranscriptEvent?.Transcript?.Results??[])if(!r.IsPartial&&r.ResultId)transcripts.set(r.ResultId,r.Alternatives?.[0]?.Transcript??'');}
   // Check current authorization again after the provider; transcripts never bypass revocation.
   await getBrief(actor,id);
   await pool.query("update private.provider_calls set outcome='completed',request_id=$2 where id=$1",[call,result.$metadata.requestId]);
   return json({transcript:[...transcripts.values()].join(' ').slice(0,1000),source_kind:'voice',saved:false,requires_review:true,raw_audio_retained:false,provider:'Amazon Transcribe',request_id:result.$metadata.requestId});
  }catch(e){await pool.query("update private.provider_calls set outcome='blocked',error_code=$2 where id=$1",[call,e instanceof Error?e.name:'UnknownError']);throw new DomainError('TRANSCRIPTION_UNAVAILABLE',503);}finally{client.destroy();}
 }catch(e){return error(e);}finally{bytes?.fill(0);}
}
