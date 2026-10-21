import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.APP_ORIGIN;
if(origin!=='http://127.0.0.1:3400')throw Error('Isolated localhost app required');
let checks=0;
async function expect(path:string,input:string,status:number,code:string,overrides:Record<string,string>={}){
 const response=await fetch(origin+path,{method:'POST',headers:{Origin:origin!,'Content-Type':'application/json',...overrides},body:input,signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,status);assert.deepEqual(await response.json(),{error:code});assert.equal(response.headers.get('cache-control'),'no-store');checks++;
}
await expect('/api/auth/signin','{}',403,'INVALID_ORIGIN',{Origin:'https://foreign.invalid'});
// Node's fetch may discard a supplied Host header. Send this boundary probe
// through raw HTTP so the on-wire host really differs from the socket target.
const hostProbe=await new Promise<{status:number;cache:string|undefined;body:string}>((resolve,reject)=>{
 const req=httpRequest(origin+'/api/auth/signin',{method:'POST',headers:{Host:'foreign.invalid',Origin:origin!,'Content-Type':'application/json','Content-Length':'2'}},response=>{
  let body='';response.setEncoding('utf8');response.on('data',chunk=>body+=chunk);response.on('end',()=>resolve({status:response.statusCode!,cache:response.headers['cache-control'],body}));
 });req.on('error',reject);req.setTimeout(10000,()=>req.destroy(Error('Host probe timeout')));req.end('{}');
});
assert.equal(hostProbe.status,403);assert.deepEqual(JSON.parse(hostProbe.body),{error:'INVALID_HOST'});assert.equal(hostProbe.cache,'no-store');checks++;
await expect('/api/auth/signin','{}',415,'JSON_REQUIRED',{'Content-Type':'application/jsonp'});
await expect('/api/auth/signin','{',400,'INVALID_JSON');
// UTF-8 bytes exceed the budget even though the JavaScript string is shorter.
await expect('/api/auth/signin',JSON.stringify({text:'🐈'.repeat(4000)}),413,'PAYLOAD_TOO_LARGE');
await expect('/api/auth/signin','{}',400,'INVALID_INPUT');
await expect('/api/mcp','{}',401,'UNAUTHORIZED');
await expect('/api/mcp','{}',401,'UNAUTHORIZED',{Authorization:'Bearer invalid-fictional-token'});
const page=await fetch(origin,{signal:AbortSignal.timeout(10000)});
for(const [key,value] of Object.entries({'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','permissions-policy':'camera=(), geolocation=(), microphone=(self)'}))assert.equal(page.headers.get(key),value);
assert.equal(page.headers.get('x-powered-by'),null);checks++;
const evidence={checked_at:new Date().toISOString(),result:'PASS',checks,scope:'Real localhost production HTTP: origin/host refusal, exact JSON media type, malformed JSON, UTF-8 byte cap, credential/schema refusal, private response caching and security headers. No valid provider call or account mutation.',limits:'Selected local boundaries; not an exhaustive penetration test, TLS/proxy/hosted review or human acceptance.'};
await mkdir('evidence/phase9',{recursive:true});await writeFile('evidence/phase9/security-http-2026-10-20.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
