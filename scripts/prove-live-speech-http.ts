import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { pool } from '../packages/domain/db';
const origin=process.env.APP_ORIGIN!;
if(origin!=='http://127.0.0.1:3400')throw Error('Isolated local app required');
const demo=await fetch(origin+'/api/demo',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({fixture:'single_cat',retention_acknowledged:true})});
assert.equal(demo.status,200);const home=await demo.json();
const cookie=demo.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const result:Record<string,unknown>={checked_at:new Date().toISOString(),scope:'Real authenticated app HTTP endpoints and live AWS speech. Fictional household, synthetic silence input. No human microphone or audible playback proof.',microphone_capture:'NOT_TESTED',audible_playback:'NOT_TESTED'};
try{
 const speech=await fetch(origin+'/api/speech',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({household_id:home.householdId}),signal:AbortSignal.timeout(20000)});
 const bytes=await speech.arrayBuffer();
 result.polly={status:speech.ok?'PASS':'BLOCKED',http_status:speech.status,audio_bytes:bytes.byteLength,content_type:speech.headers.get('content-type'),epoch:speech.headers.get('x-denlumi-epoch'),caption_present:!!speech.headers.get('x-denlumi-caption')};
 const transcribe=await fetch(origin+'/api/transcription',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'audio/pcm;rate=16000;channels=1','X-Denlumi-Household':home.householdId},body:new Uint8Array(32000),signal:AbortSignal.timeout(30000)});
 const response=await transcribe.json();
 result.transcribe={status:transcribe.ok?'PASS':'BLOCKED',http_status:transcribe.status,input:'One second synthetic PCM silence; transport proof only',...response};
 result.provider_calls=(await pool.query('select provider,outcome,request_id,error_code from private.provider_calls where household_id=$1 order by created_at',[home.householdId])).rows;
 await mkdir('evidence/phase6',{recursive:true});await writeFile('evidence/phase6/speech-http.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 assert.equal(speech.status,200);assert.equal(transcribe.status,200);assert.equal(response.saved,false);assert.equal(response.requires_review,true);
}finally{await pool.end();}
