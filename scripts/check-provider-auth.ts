import { execFileSync } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
let status='PASS',reason='AWS identity request succeeded';
try{execFileSync('aws',['sts','get-caller-identity','--profile','default','--query','length(Arn)','--output','text'],{timeout:15000,stdio:['ignore','pipe','pipe']});}
catch(e){status='BLOCKED';const stderr=String((e as {stderr?:Buffer}).stderr??'');reason=stderr.includes('expired')?'EXPIRED_AWS_SESSION':'AWS_AUTH_UNAVAILABLE';}
const evidence={checked_at:new Date().toISOString(),status,reason,scope:'AWS CLI identity check only. Account identifiers and credentials omitted.',bedrock_request_sent:false,speech_request_sent:false};
await mkdir('evidence/phase6',{recursive:true});await writeFile('evidence/phase6/provider-auth.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
