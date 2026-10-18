import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';
import { mkdir,writeFile } from 'node:fs/promises';
const region=process.env.AWS_REGION||'us-east-1', modelId=process.env.BEDROCK_MODEL_ID!;
const result:Record<string,unknown>={checked_at:new Date().toISOString(),region,model_id:modelId,scope:'Live provider feasibility requests; fictional text only. No real animal guidance.',cost_guard:{max_bedrock_requests:1,max_output_tokens:96,retries:0,max_polly_characters:100,max_transcribe_seconds:15},tests:{}};
const tests=result.tests as Record<string,unknown>;
function failure(e:unknown) {const x=e as Error&{$metadata?:{requestId?:string;httpStatusCode?:number}};return {status:'BLOCKED',error:x.name,message:x.message.replace(/\b\d{12}\b/g,'[account]'),request_id:x.$metadata?.requestId,http_status:x.$metadata?.httpStatusCode};}
try {
 const c=new BedrockRuntimeClient({region,maxAttempts:1});
 const r=await c.send(new ConverseCommand({modelId,messages:[{role:'user',content:[{text:'This is a fictional software test. Say only: Denlumi connection confirmed.'}]}],inferenceConfig:{maxTokens:96,temperature:0}}),{abortSignal:AbortSignal.timeout(15000)});
 tests.bedrock={status:'PASS',request_id:r.$metadata.requestId,http_status:r.$metadata.httpStatusCode,stop_reason:r.stopReason,usage:r.usage,text:r.output?.message?.content};c.destroy();
}catch(e){tests.bedrock=failure(e);}
let pcm:Uint8Array|undefined;
try {
 const c=new PollyClient({region,maxAttempts:1});
 const r=await c.send(new SynthesizeSpeechCommand({Text:'Fictional Denlumi connection test.',VoiceId:'Joanna',Engine:'standard',OutputFormat:'pcm',SampleRate:'16000'}),{abortSignal:AbortSignal.timeout(15000)});
 pcm=await r.AudioStream?.transformToByteArray();
 tests.polly={status:pcm?.length?'PASS':'BLOCKED',request_id:r.$metadata.requestId,http_status:r.$metadata.httpStatusCode,audio_bytes:pcm?.length,encoding:'PCM signed 16-bit little-endian, mono, 16000 Hz',audible_playback:'NOT_TESTED'};c.destroy();
}catch(e){tests.polly=failure(e);}
try {
 const c=new TranscribeStreamingClient({region,maxAttempts:1});
 const sample=(pcm??new Uint8Array(32000)).slice(0,480000);
 const stream=async function*(){ for(let n=0;n<sample.length;n+=3200) {yield {AudioEvent:{AudioChunk:sample.slice(n,n+3200)}};await new Promise(r=>setTimeout(r,100));} };
 const r=await c.send(new StartStreamTranscriptionCommand({LanguageCode:'en-US',MediaEncoding:'pcm',MediaSampleRateHertz:16000,AudioStream:stream()}),{abortSignal:AbortSignal.timeout(15000)});
 const transcript:string[]=[];
 for await(const event of r.TranscriptResultStream??[]) {for(const v of event.TranscriptEvent?.Transcript?.Results??[])if(!v.IsPartial)transcript.push(v.Alternatives?.[0]?.Transcript??'');}
 tests.transcribe={status:'PASS',request_id:r.$metadata.requestId,http_status:r.$metadata.httpStatusCode,input:pcm?'Polly fictional sample':'one second synthetic silence; connection proof only',audio_seconds:sample.length/32000,transcript,microphone_capture:'NOT_TESTED'};c.destroy();
}catch(e){tests.transcribe=failure(e);}
const evidenceDir=process.env.DENLUMI_PROVIDER_EVIDENCE_DIR??'evidence/phase0';
if(!/^evidence\/phase(?:0|6)$/.test(evidenceDir))throw Error('Unsupported provider evidence directory');
await mkdir(evidenceDir,{recursive:true});
await writeFile(`${evidenceDir}/providers.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
