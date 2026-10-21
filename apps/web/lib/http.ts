import { ZodError } from 'zod';
import { DomainError } from '../../../packages/domain/db';
import { authenticateToken } from '../../../packages/domain/auth';
export const origin=()=>process.env.APP_ORIGIN!;
export function guard(req:Request,requireOrigin=false) {
 const allowed=new URL(origin());
 if(req.headers.get('host')!==allowed.host)throw new DomainError('INVALID_HOST',403);
 const from=req.headers.get('origin');
 if((from&&from!==allowed.origin)||(requireOrigin&&from!==allowed.origin))throw new DomainError('INVALID_ORIGIN',403);
}
export function cookie(req:Request,name='denlumi_session') {
 const token=req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
 return token;
}
export async function identity(req:Request,onlyBearer=false,cookieName='denlumi_session') {
 const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 const token=onlyBearer?bearer:cookie(req,cookieName)??bearer;
 if(!token)throw new DomainError('UNAUTHORIZED',401);
 return {actor:await authenticateToken(token),token};
}
export const sessionCookie=(name:string,value:string)=>`${name}=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=3600${origin().startsWith('https:')?'; Secure':''}`;
export const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function body(req:Request) {
 if(req.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()!=='application/json')throw new DomainError('JSON_REQUIRED',415);
 const maximumBytes=16000,declared=req.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maximumBytes)){
  await req.body?.cancel().catch(()=>{});
  throw new DomainError(/^\d+$/.test(declared)?'PAYLOAD_TOO_LARGE':'INVALID_CONTENT_LENGTH',/^\d+$/.test(declared)?413:400);
 }
 const chunks:Uint8Array[]=[],reader=req.body?.getReader();let length=0;
 if(reader)try{
  for(;;){
   const chunk=await reader.read();if(chunk.done)break;
   length+=chunk.value.byteLength;
   // Check bytes before retaining or decoding a chunk, including chunked requests.
   if(length>maximumBytes){await reader.cancel().catch(()=>{});throw new DomainError('PAYLOAD_TOO_LARGE',413);}
   chunks.push(chunk.value);
  }
 }finally{reader.releaseLock();}
 if(declared!==null&&Number(declared)!==length)throw new DomainError('INVALID_CONTENT_LENGTH',400);
 const bytes=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new DomainError('INVALID_JSON',400);}
}
export function error(e:unknown) {
 if(e instanceof DomainError)return json({error:e.code},e.status);
 if(e instanceof ZodError)return json({error:'INVALID_INPUT'},400);
 console.error('Denlumi request failed:',e instanceof Error?e.name:'UnknownError');
 return json({error:'SERVICE_UNAVAILABLE'},503);
}
const buckets=new Map<string,{start:number,count:number}>();
export function rateLimit(key:string,max=100) {
 const now=Date.now(),b=buckets.get(key);
 if(!b||now-b.start>60000){buckets.set(key,{start:now,count:1});}
 else if(++b.count>max)throw new DomainError('RATE_LIMITED',429);
 if(buckets.size>2000)for(const [k,v] of buckets)if(now-v.start>60000)buckets.delete(k);
}
