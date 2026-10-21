// A separate, allowlisted publication checkout keeps local credentials and agent files private.
import { mkdir, readFile, readdir, writeFile, lstat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { releasePaths, sanitizePublication } from './public-release-utils.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {checkOnly,output,manifestPath}=releasePaths(root,process.argv.slice(2));
const roots=['apps/web','apps/showcase','packages','scripts','tests','supabase','docs','Denlumi_Build_Pack_v1','evidence'];
const files=['.node-version','.nvmrc','.env.example','.gitignore','LICENSE','THIRD_PARTY_NOTICES.md','README.md','DECISIONS.md','package.json','package-lock.json','tsconfig.json','playwright.config.ts','full-erd.mmd','devpost-submission.md','evidence/phase6/providers.json'];
const ignored=new Set(['node_modules','.next','.git','.local','.vercel','.temp','.branches','__pycache__','test-results','playwright-report']);
const excluded=new Set(['AGENTS.md','CLAUDE.md','.DS_Store']);
const permitted=/\.(?:tsx?|mjs|js|json|sql|toml|md|mmd|py|css|html|svg|png|txt|tap|mp4|vtt)$/;
const secrets=[];
try {for(const line of (await readFile(resolve(root,'.env.local'),'utf8')).split(/\r?\n/)){
 const at=line.indexOf('=');const key=line.slice(0,at),value=line.slice(at+1);
 if(at>0&&/KEY|SECRET|TOKEN|PASSWORD/.test(key)&&value.length>=16)secrets.push(value);
}}catch(e){if(e.code!=='ENOENT')throw e;}
const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,/\bsb_secret_[A-Za-z0-9_-]{20,}/,/\bd1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}\b/];
async function collect(path){
 // Fresh browser captures may contain one-time deletion codes. Keep them local;
 // publish only the separately written redacted result summary for these runs.
 if(path==='evidence/phase10/browser')return;
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
 const source_sha256=createHash('sha256').update(bytes).digest('hex'), source_bytes=bytes.length;
 if(!/\.(?:png|mp4)$/.test(path)){
  let text=bytes.toString('utf8');
  if(secrets.some(s=>text.includes(s))||patterns.some(p=>p.test(text)))throw new Error(`Secret candidate: ${path}; publication stopped`);
  text=sanitizePublication(text,path,root);
  bytes=Buffer.from(text);
 }
 manifest.push({path,source_sha256,source_bytes,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,data:bytes});
}
// The specification's original inventory includes omitted operator files. Rebuild it
// against the actual sanitized publication, without changing the original pack.
const packPrefix='Denlumi_Build_Pack_v1/';
const packManifest=manifest.find(file=>file.path===packPrefix+'MANIFEST.json');
if(packManifest){
 const original=JSON.parse(packManifest.data.toString('utf8'));
 original.publication_scope='Sanitized public snapshot; operator instructions excluded; hashes describe these published bytes.';
 original.files=manifest.filter(file=>file.path.startsWith(packPrefix)&&file!==packManifest).map(file=>({path:file.path.slice(packPrefix.length),bytes:file.bytes,sha256:file.sha256}));
 packManifest.data=Buffer.from(JSON.stringify(original,null,2)+'\n');
 packManifest.bytes=packManifest.data.length;
 packManifest.sha256=createHash('sha256').update(packManifest.data).digest('hex');
}
// Read-only hardening check: validate the publication inputs and emitted browser
// chunks without refreshing the retained publication checkout or its manifest.
if(checkOnly){
 let assets=0;
 async function scanAssets(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,entry.name);
  if(entry.isSymbolicLink())throw new Error('Browser asset symlink refused');
  if(entry.isDirectory())await scanAssets(path);
  else if(/\.(?:js|json|map|css)$/.test(entry.name)){
   const text=await readFile(path,'utf8');
   if(secrets.some(value=>text.includes(value))||patterns.some(pattern=>pattern.test(text)))throw new Error('Credential candidate in emitted browser asset; check stopped');
   assets++;
  }
 }}
 await scanAssets(resolve(root,'apps/web/.next/static'));
 if(!assets)throw new Error('No emitted browser assets found; build first');
 console.log(JSON.stringify({status:'PASS',mode:'read-only',source_files:manifest.length,browser_assets:assets,limits:'Selected credential patterns and known local secret values only; no exhaustive leak audit, public refresh or publication.'}));
 process.exit(0);
}
// Refuse a stale/injected file in a retained release checkout rather than silently publishing it.
try {if((await lstat(output)).isSymbolicLink())throw Error('Release output symlink refused');}catch(e){if(e.code!=='ENOENT')throw e;}
try {async function verify(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 if(entry.name==='.git')continue;
 const path=resolve(dir,entry.name);const name=relative(output,path);
 if(entry.isSymbolicLink())throw new Error(`Release symlink refused: ${name}`);
 if(entry.isDirectory())await verify(path);else if(!manifest.some(m=>m.path===name))throw new Error(`Unexpected release file: ${name}`);
 }}await verify(output);}catch(e){if(e.code!=='ENOENT')throw e;}
for(const file of manifest){const path=resolve(output,file.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,file.data);}
await mkdir(resolve(root,'.local'),{recursive:true});
await writeFile(manifestPath,JSON.stringify({created_at:new Date().toISOString(),scope:'Allowlisted source and historical fictional showcase media; no environment credentials',hash_provenance:'source_sha256/source_bytes describe input bytes; sha256/bytes describe sanitized output. Historical execution evidence is retained unchanged except text redaction and is not a claim that sanitized document bytes were executed.',files:manifest.map(({data,...m})=>m)},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',files:manifest.length,bytes:manifest.reduce((n,f)=>n+f.bytes,0),output,secret_scan:'No known local secret values or selected credential patterns found; this is not an exhaustive security audit.'}));
