import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname,resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const values={};
for(const line of readFileSync(resolve(root,'.env.local'),'utf8').split(/\r?\n/)){
 if(!line||line.startsWith('#'))continue;
 const at=line.indexOf('=');if(at<1)continue;values[line.slice(0,at)]=line.slice(at+1);
}
const child=spawn(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),...process.argv.slice(2)],{
 cwd:resolve(root,'apps/web'),env:{...values,...process.env},stdio:'inherit'
});
child.on('exit',(code,signal)=>{if(signal)process.kill(process.pid,signal);else process.exit(code??1);});
