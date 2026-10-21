// Production-browser speech UI regression with no real AWS endpoint or credentials.
// Requires a built app and a free local app port; never stops an existing server.
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.loadEnvFile(resolve(root,'.env.local'));
const origin='http://127.0.0.1:3400';
if(process.env.APP_ORIGIN!==origin)throw Error('Isolated local app origin required');
for(const [key,port] of [['SUPABASE_URL','55431'],['DATABASE_URL','55432']]){
 const target=new URL(process.env[key]??'');
 if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!==port)throw Error('Isolated local database/Auth required');
}
try{await fetch(origin,{signal:AbortSignal.timeout(500)});throw Error('App port already occupied; stop your own app before running mocked voice checks');}
catch(error){if(!String(error.cause?.code).includes('ECONNREFUSED'))throw error;}
const configDir=await mkdtemp(join(tmpdir(),'denlumi-mocked-voice-'));
const emptyConfig=join(configDir,'empty-config');await writeFile(emptyConfig,'',{mode:0o600});
const env={...process.env};
for(const key of Object.keys(env))if(key.startsWith('AWS_'))delete env[key];
Object.assign(env,{DENLUMI_MOCKED_VOICE:'1',APP_ORIGIN:origin,DENLUMI_DEMO_ENABLED:'true',BEDROCK_ENABLED:'false',SPEECH_ENABLED:'true',
 AWS_REGION:'us-east-1',AWS_ACCESS_KEY_ID:'fictional-local-test-key',AWS_SECRET_ACCESS_KEY:'fictional-local-test-secret',
 AWS_ENDPOINT_URL:'http://127.0.0.1:9',AWS_ENDPOINT_URL_POLLY:'http://127.0.0.1:9',AWS_ENDPOINT_URL_TRANSCRIBE_STREAMING:'http://127.0.0.1:9',AWS_ENDPOINT_URL_BEDROCK_RUNTIME:'http://127.0.0.1:9',
 AWS_CONFIG_FILE:emptyConfig,AWS_SHARED_CREDENTIALS_FILE:emptyConfig,AWS_EC2_METADATA_DISABLED:'true',AWS_IGNORE_CONFIGURED_ENDPOINT_URLS:'false'});
let server,runner;
async function stop(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;child.kill('SIGTERM');let timer;try{await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>{timer=setTimeout(resolve,5000);})]);}finally{clearTimeout(timer);}if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));}}
const interrupt=()=>{void stop(runner);void stop(server);};
process.once('SIGINT',interrupt);process.once('SIGTERM',interrupt);
try{
 console.log('MOCKED speech UI only: fictional credentials; AWS endpoints loop back to port 9; Bedrock disabled; browser intercepts speech responses.');
 server=spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3400'],{cwd:resolve(root,'apps/web'),env,stdio:'inherit'});
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){
  if(server.exitCode!==null||server.signalCode!==null)throw Error('Task-owned voice app exited');
  try{if((await fetch(origin,{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!ready)throw Error('Task-owned voice app did not become ready');
 runner=spawn(process.execPath,[resolve(root,'node_modules/@playwright/test/cli.js'),'test','tests/e2e/phase6.spec.ts'],{cwd:root,env,stdio:'inherit'});
 process.exitCode=await new Promise((resolve,reject)=>{runner.once('error',reject);runner.once('exit',code=>resolve(code??1));});
}finally{
 await stop(runner);await stop(server);await rm(configDir,{recursive:true,force:true});
 process.removeListener('SIGINT',interrupt);process.removeListener('SIGTERM',interrupt);
}
