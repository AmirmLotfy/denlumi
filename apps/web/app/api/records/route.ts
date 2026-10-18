import { recordRequest } from '../../../../../packages/contracts/phase7';
import { previewPrivateRecord,authorizePrivateRecord,listPrivateRecords,downloadPrivateExport,viewSharedRecord,revokePrivateShare,archivePrivatePet,requestHouseholdDeletion,householdDeletionStatus,processHouseholdDeletion,prepareExpiredDemoDeletion } from '../../../../../packages/domain/records';
import { householdActor,requestKey } from '../../../lib/household-http';
import { body,error,json } from '../../../lib/http';
// Human-only cookie + same-origin endpoint. No operation is available to model tools.
export async function POST(req:Request){try{
 const actor=await householdActor(req),i=recordRequest.parse(await body(req)),key=requestKey(req);
 switch(i.action){
  case 'preview':return json(await previewPrivateRecord(actor,i.input,key),201);
  case 'authorize':return json(await authorizePrivateRecord(actor,i.input,key),201);
  case 'list':return json(await listPrivateRecords(actor,i.household_id));
  case 'revoke':return json(await revokePrivateShare(actor,i.input,key));
  case 'archive':return json(await archivePrivatePet(actor,i.input,key));
  case 'delete_request':return json(await requestHouseholdDeletion(actor,i.input,key),202);
  case 'delete_prepare':return json(await prepareExpiredDemoDeletion(actor,i.household_id));
  case 'delete_status':return json(await householdDeletionStatus(actor,i.request_id));
  case 'delete_process':return json(await processHouseholdDeletion(actor,i.request_id));
  case 'view_share':return json(await viewSharedRecord(actor,i.grant_id));
  case 'download':{const e=await downloadPrivateExport(actor,i.export_id);return new Response(e.content,{headers:{'Content-Type':`${e.mime_type}; charset=utf-8`,'Content-Disposition':`attachment; filename="${e.filename}"`,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}});}
 }
}catch(e){return error(e);}}
