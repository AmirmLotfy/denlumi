import { guard,identity,error,body,rateLimit,json } from '../../../lib/http';
import { handleMcp,MCP_VERSION } from '../../../lib/mcp';
export const runtime='nodejs';
export async function POST(req:Request) {
 try{
  guard(req);const {actor}=await identity(req,true);rateLimit(`mcp:${actor.userId}`);
  const version=req.headers.get('mcp-protocol-version');
  if(version&&version!==MCP_VERSION)return json({error:'UNSUPPORTED_PROTOCOL_VERSION'},400);
  return await handleMcp(req,actor,await body(req));
 }catch(e){return error(e);}
}
export async function GET(req:Request) {try{guard(req);await identity(req,true);return new Response(null,{status:405,headers:{Allow:'POST, DELETE'}});}catch(e){return error(e);}}
export async function DELETE(req:Request) {try{guard(req);const {actor}=await identity(req,true);return await handleMcp(req,actor);}catch(e){return error(e);}}
