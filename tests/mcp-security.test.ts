import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {handleMcp,MCP_VERSION} from '../apps/web/lib/mcp';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {pool,type Actor} from '../packages/domain/db';
after(()=>pool.end());
const actor=():Actor=>({userId:crypto.randomUUID(),sessionId:crypto.randomUUID()});
const initialize={jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:MCP_VERSION,capabilities:{},clientInfo:{name:'security-regression',version:'1'}}};
const request=(id?:string,method='POST')=>new Request('http://127.0.0.1:3400/api/mcp',{method,headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(id?{'mcp-session-id':id,'mcp-protocol-version':MCP_VERSION}:{})},...(method==='POST'?{body:JSON.stringify(initialize)}:{})});
async function open(a:Actor){const response=await handleMcp(request(),a,initialize);assert.equal(response.status,200);const id=response.headers.get('mcp-session-id');assert.ok(id);return id;}
async function close(a:Actor,ids:string[]){for(const id of ids)await handleMcp(request(id,'DELETE'),a).catch(()=>{});}
test('MCP caps sessions per authenticated actor and DELETE frees capacity',async()=>{
 const a=actor(),ids:string[]=[];
 try{for(let i=0;i<8;i++)ids.push(await open(a));
  await assert.rejects(open(a),{code:'MCP_SESSION_LIMIT',status:429});
  await close(a,[ids.pop()!]);ids.push(await open(a));
 }finally{await close(a,ids);}
});
test('MCP expires even a small idle session set and does not accept stale IDs',async()=>{
 const a=actor(),ids=[await open(a)],realNow=Date.now,then=realNow();
 try{Date.now=()=>then+15*60_000+1;
  await assert.rejects(handleMcp(request(ids[0]),a,initialize),{code:'MCP_SESSION_NOT_FOUND',status:404});
  ids.length=0;ids.push(await open(a));
 }finally{Date.now=realNow;await close(a,ids);}
});
test('MCP sessions bind both profile and login session; private tool discovery is not cached',async()=>{
 const a=actor(),ids=[await open(a)];
 try{for(const b of [{...a,userId:crypto.randomUUID()},{...a,sessionId:crypto.randomUUID()}])await assert.rejects(handleMcp(request(ids[0]),b,initialize),{code:'SCOPE_MISMATCH',status:403});
  const response=await handleMcp(request(ids[0]),a,{jsonrpc:'2.0',id:2,method:'tools/list'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).result.tools.length,9);
 }finally{await close(a,ids);}
});
test('invalid initialization does not consume the authenticated session allowance',async()=>{
 const a=actor(),ids:string[]=[];
 try{for(let i=0;i<10;i++){const response=await handleMcp(request(),a,{jsonrpc:'2.0',id:1,method:'ping'});assert.equal(response.status,400);}
  for(let i=0;i<8;i++)ids.push(await open(a));
 }finally{await close(a,ids);}
});
test('MCP caps total live sessions across actors and recovers after termination',async()=>{
 const groups:{a:Actor;ids:string[]}[]=[];
 try{for(let i=0;i<13;i++){const a=actor(),ids:string[]=[];groups.push({a,ids});for(let j=0;j<(i===12?4:8);j++)ids.push(await open(a));}
  await assert.rejects(open(actor()),{code:'MCP_SESSION_LIMIT',status:503});
  const first=groups[0];await close(first.a,[first.ids.pop()!]);const a=actor(),id=await open(a);groups.push({a,ids:[id]});
 }finally{for(const group of groups)await close(group.a,group.ids);}
});
test('concurrent MCP initialization reserves admission before awaiting transport setup',async()=>{
 const a=actor(),ids:string[]=[];
 try{const results=await Promise.allSettled(Array.from({length:16},()=>open(a)));
  for(const result of results){if(result.status==='fulfilled')ids.push(result.value);else assert.equal(result.reason.code,'MCP_SESSION_LIMIT');}
  assert.equal(ids.length,8);assert.equal(results.filter(result=>result.status==='rejected').length,8);
 }finally{await close(a,ids);}
});
test('the app orchestrator explicitly terminates completed HTTP sessions',async()=>{
 const {connectMcp,closeMcp}=await import('../apps/web/lib/mcp');
 const a=actor(),original=globalThis.fetch;let deletions=0;
 try{globalThis.fetch=async(input,init)=>{
  const req=new Request(input,init);
  if(req.method==='GET')return new Response(null,{status:405});
  if(req.method==='DELETE')deletions++;
  return handleMcp(req,a,req.method==='POST'?await req.json():undefined);
 };
  for(let i=0;i<12;i++){const client=await connectMcp('fictional-local-token');assert.equal((await client.listTools()).tools.length,9);await closeMcp(client);}
  assert.equal(deletions,12);
 }finally{globalThis.fetch=original;}
});
test('MCP rejects JSON-RPC batches without leaving a permanently busy session',async()=>{
 const a=actor(),ids=[await open(a)];
 try{const batch=[{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:2}}];
  const result=await Promise.race([handleMcp(request(ids[0]),a,batch).then(()=> 'ACCEPTED',error=>error.code),new Promise(resolve=>setTimeout(()=>resolve('HUNG'),80))]);
  assert.equal(result,'MCP_BATCH_NOT_SUPPORTED');
  const response=await handleMcp(request(ids[0]),a,{jsonrpc:'2.0',id:3,method:'tools/list'});assert.equal(response.status,200);
 }finally{await close(a,ids);}
});
test('aborted in-flight MCP work releases its session and restores admission',async(t)=>{
 const a=actor(),ids=[await open(a)],controller=new AbortController();
 let started!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;});
 const blocked=t.mock.method(WebStandardStreamableHTTPServerTransport.prototype,'handleRequest',()=>{started();return new Promise<Response>(()=>{});});
 try{
  const pending=handleMcp(new Request(request(ids[0]),{signal:controller.signal}),a,{jsonrpc:'2.0',id:2,method:'tools/list'});
  const rejected=assert.rejects(pending,{code:'MCP_REQUEST_ABORTED'});await entered;controller.abort();await rejected;blocked.mock.restore();
  await assert.rejects(handleMcp(request(ids[0]),a,initialize),{code:'MCP_SESSION_NOT_FOUND'});
  ids.length=0;for(let i=0;i<8;i++)ids.push(await open(a));
 }finally{blocked.mock.restore();await close(a,ids);}
});
test('MCP deadline releases a transport that never produces a response',async(t)=>{
 const a=actor(),ids=[await open(a)];let started!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;});
 const blocked=t.mock.method(WebStandardStreamableHTTPServerTransport.prototype,'handleRequest',()=>{started();return new Promise<Response>(()=>{});});
 t.mock.timers.enable({apis:['setTimeout']});
 try{
  const pending=handleMcp(request(ids[0]),a,{jsonrpc:'2.0',id:2,method:'tools/list'});
  const rejected=assert.rejects(pending,{code:'MCP_REQUEST_TIMEOUT',status:504});await entered;t.mock.timers.tick(10_000);await rejected;
  blocked.mock.restore();t.mock.timers.reset();
  await assert.rejects(handleMcp(request(ids[0]),a,initialize),{code:'MCP_SESSION_NOT_FOUND'});
  ids.length=0;ids.push(await open(a));
 }finally{blocked.mock.restore();t.mock.timers.reset();await close(a,ids);}
});
