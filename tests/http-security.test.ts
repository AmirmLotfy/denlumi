import test from 'node:test';
import assert from 'node:assert/strict';
import { body,error } from '../apps/web/lib/http';

const encode=(value:string)=>new TextEncoder().encode(value);
function streamed(chunks:Uint8Array[],headers:Record<string,string>={}){
 let pulls=0,cancelled=false;
 const stream=new ReadableStream<Uint8Array>({
  pull(controller){const chunk=chunks[pulls++];if(chunk)controller.enqueue(chunk);else controller.close();},
  cancel(){cancelled=true;}
 },{highWaterMark:0});
 const request=new Request('http://127.0.0.1:3400/api/auth/signin',{
  method:'POST',headers:{'Content-Type':'application/json',...headers},body:stream,duplex:'half'
 } as RequestInit);
 return {request,state:()=>({pulls,cancelled})};
}
async function refused(request:Request,code:string,status:number){
 let failure:unknown;
 try{await body(request);}catch(e){failure=e;}
 assert.ok(failure,'request must fail');
 const response=error(failure);
 assert.equal(response.status,status);
 assert.deepEqual(await response.json(),{error:code});
}

test('JSON body accepts a streamed valid request and an exact 16,000-byte body',async()=>{
 const small=streamed([encode('{"message":'),encode('"fictional"}')],{'Content-Type':'Application/JSON; charset=utf-8'});
 assert.deepEqual(await body(small.request),{message:'fictional'});
 const exact=streamed([encode('"'+'a'.repeat(15998)+'"')],{'Content-Length':'16000'});
 assert.equal((await body(exact.request) as string).length,15998);
});

test('JSON body cancels chunked overflow before reading the remaining request',async()=>{
 const input=streamed([new Uint8Array(8000).fill(32),new Uint8Array(8001).fill(32),encode('unread private input')]);
 await refused(input.request,'PAYLOAD_TOO_LARGE',413);
 assert.deepEqual(input.state(),{pulls:2,cancelled:true});
});

test('JSON byte budget includes multibyte UTF-8 characters',async()=>{
 const input=streamed([encode('"'+'猫'.repeat(5333)+'"')]);
 await refused(input.request,'PAYLOAD_TOO_LARGE',413);
 assert.equal(input.state().cancelled,true);
});

test('JSON body rejects oversized declared length without reading bytes',async()=>{
 const input=streamed([encode('{}')],{'Content-Length':'16001'});
 await refused(input.request,'PAYLOAD_TOO_LARGE',413);
 assert.deepEqual(input.state(),{pulls:0,cancelled:true});
});

test('JSON body rejects malformed Content-Length before reading bytes',async()=>{
 for(const length of ['', '-1','1.5','1e3','2, 2','unknown']){
  const input=streamed([encode('{}')],{'Content-Length':length});
  await refused(input.request,'INVALID_CONTENT_LENGTH',400);
  assert.deepEqual(input.state(),{pulls:0,cancelled:true});
 }
});

test('JSON body validates declared length against actual bytes',async()=>{
 for(const length of ['0','1','3']){
  const input=streamed([encode('{}')],{'Content-Length':length});
  await refused(input.request,'INVALID_CONTENT_LENGTH',400);
 }
});

test('JSON Content-Type must name application/json rather than a prefix match',async()=>{
 for(const type of ['application/jsonp','application/json-seq','text/plain']){
  const input=streamed([encode('{}')],{'Content-Type':type});
  await refused(input.request,'JSON_REQUIRED',415);
  assert.equal(input.state().pulls,0);
 }
});

test('malformed JSON, empty input and invalid UTF-8 have structured errors',async()=>{
 for(const chunks of [[encode('{')],[],[new Uint8Array([34,255,34])]]){
  await refused(streamed(chunks).request,'INVALID_JSON',400);
 }
});
