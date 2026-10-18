// A separate, allowlisted publication checkout keeps local credentials and agent files private.
import { mkdir, readFile, readdir, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(root,'.local/public-release');
const roots=['apps/web','apps/showcase','packages','scripts','tests','supabase','docs','Denlumi_Build_Pack_v1','evidence'];
const files=['.env.example','.gitignore','LICENSE','THIRD_PARTY_NOTICES.md','README.md','package.json','package-lock.json','tsconfig.json','playwright.config.ts','full-erd.mmd','devpost-submission.md','evidence/phase6/providers.json'];
const ignored=new Set(['node_modules','.next','.git','.local','.vercel','.temp','.branches','__pycache__','test-results','playwright-report']);
const excluded=new Set(['AGENTS.md','CLAUDE.md','.DS_Store']);
const permitted=/\.(?:tsx?|mjs|js|json|sql|toml|md|mmd|py|css|html|svg|png|txt|tap)$/;
const secrets=[];
try {for(const line of (await readFile(resolve(root,'.env.local'),'utf8')).split(/\r?\n/)){
 const at=line.indexOf('=');const key=line.slice(0,at),value=line.slice(at+1);
 if(at>0&&/KEY|SECRET|TOKEN|PASSWORD/.test(key)&&value.length>=16)secrets.push(value);
}}catch(e){if(e.code!=='ENOENT')throw e;}
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/];
async function collect(path){
 const info=await lstat(resolve(root,path));
 if(info.isSymbolicLink())throw new Error(`Symlink refused: ${path}`);
 if(info.isDirectory()){for(const name of (await readdir(resolve(root,path))).sort()){
  if(ignored.has(name)||excluded.has(name)||name.startsWith('.env')||name.endsWith('.tsbuildinfo'))continue;
  await collect(`${path}/${name}`);
 }}else if(permitted.test(path))files.push(path);
}
for(const path of roots)await collect(path);
const manifest=[];
// Validate all files before writing any artifact. Never print matching secret content.
for(const path of [...new Set(files)].sort()){
 let bytes=await readFile(resolve(root,path));
 if(!path.endsWith('.png')){
  let text=bytes.toString('utf8');
  if(secrets.some(s=>text.includes(s))||patterns.some(p=>p.test(text)))throw new Error(`Secret candidate: ${path}; publication stopped`);
  if(/\.(?:md|json|tap)$/.test(path))text=text.replaceAll(root+'/','./').replaceAll(root,'<local-workspace>').replaceAll('/Users/frameless/','<local-home>/').replace(/arn:aws:[^\s"<>]*:\d{12}:[^\s"<>]*/g,'<redacted-account-resource-arn>');
  bytes=Buffer.from(text);
 }
 manifest.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,data:bytes});
}
// Refuse a stale/injected file in a retained release checkout rather than silently publishing it.
try {async function verify(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 if(entry.name==='.git')continue;
 const path=resolve(dir,entry.name);const name=relative(output,path);
 if(entry.isSymbolicLink())throw new Error(`Release symlink refused: ${name}`);
 if(entry.isDirectory())await verify(path);else if(!manifest.some(m=>m.path===name))throw new Error(`Unexpected release file: ${name}`);
 }}await verify(output);}catch(e){if(e.code!=='ENOENT')throw e;}
for(const file of manifest){const path=resolve(output,file.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,file.data);}
await mkdir(resolve(root,'.local'),{recursive:true});
await writeFile(resolve(root,'.local/public-release-manifest.json'),JSON.stringify({created_at:new Date().toISOString(),scope:'Allowlisted source; original fictional screenshot only; no environment credentials',files:manifest.map(({data,...m})=>m)},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',files:manifest.length,bytes:manifest.reduce((n,f)=>n+f.bytes,0),output,secret_scan:'No known local secret values or selected credential patterns found; this is not an exhaustive security audit.'}));
