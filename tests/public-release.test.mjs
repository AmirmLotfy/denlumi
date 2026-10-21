import test from 'node:test';
import assert from 'node:assert/strict';
import {releasePaths,sanitizePublication} from '../scripts/public-release-utils.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,copyFileSync,rmSync,symlinkSync,existsSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='/workspace/Denlumi';
test('candidate output cannot escape the ignored direct-child boundary',()=>{
 for(const value of ['.local','../other','.local/../docs','.local/nested/out','/tmp/release'])assert.throws(()=>releasePaths(root,['--output',value]));
 const paths=releasePaths(root,['--output','.local/review','--check']);
 assert.equal(paths.output,root+'/.local/review');assert.equal(paths.manifestPath,root+'/.local/review-manifest.json');assert.equal(paths.checkOnly,true);
 assert.throws(()=>releasePaths(root,['--unknown']));assert.throws(()=>releasePaths(root,['--output']));
});
test('absolute document links are relative to the containing publication file',()=>{
 assert.equal(sanitizePublication(`[plan](${root}/docs/ROADMAP.md#next)`, 'docs/submission/READINESS.md',root),'[plan](../ROADMAP.md#next)');
 assert.equal(sanitizePublication(`[plan](${root}/docs/ROADMAP.md)`, 'README.md',root),'[plan](docs/ROADMAP.md)');
});
test('omitted operator links cannot become broken publication links',()=>{
 for(const target of ['AGENTS.md','../AGENTS.md','../../CLAUDE.md',root+'/AGENTS.md'])assert.match(sanitizePublication(`[rules](${target})`,'docs/test.md',root),/omitted/);
});
test('historical hashes survive path and account redaction',()=>{
 const hash='a'.repeat(64), original=JSON.stringify({path:root+'/docs/test.md',sha256:hash,arn:'arn:aws:service:region:123456789012:resource'});
 const sanitized=JSON.parse(sanitizePublication(original,'evidence/test.json',root));
 assert.equal(sanitized.sha256,hash);assert.equal(sanitized.path,'./docs/test.md');assert.equal(sanitized.arn,'<redacted-account-resource-arn>');
});
function fixture(run) {
 const folder=realpathSync(mkdtempSync(resolve(tmpdir(),'denlumi-export-test-')));
 try {
  for(const path of ['apps/web','apps/showcase','packages','scripts','tests','supabase','docs','Denlumi_Build_Pack_v1','evidence/phase6'])mkdirSync(resolve(folder,path),{recursive:true});
  for(const path of ['.node-version','.nvmrc','.env.example','.gitignore','LICENSE','THIRD_PARTY_NOTICES.md','README.md','DECISIONS.md','package.json','package-lock.json','tsconfig.json','playwright.config.ts','full-erd.mmd','devpost-submission.md','evidence/phase6/providers.json','Denlumi_Build_Pack_v1/MANIFEST.json'])writeFileSync(resolve(folder,path),path.endsWith('.json')?'{}\n':'fictional fixture\n');
  for(const path of ['prepare-public-release.mjs','public-release-utils.mjs'])copyFileSync(new URL('../scripts/'+path,import.meta.url),resolve(folder,'scripts',path));
  run(folder,()=>spawnSync(process.execPath,[resolve(folder,'scripts/prepare-public-release.mjs'),'--output','.local/review'],{encoding:'utf8'}));
 }finally {rmSync(folder,{recursive:true,force:true});}
}
test('real export writes separate source/output hashes and refuses injected stale files',()=>fixture((folder,run)=>{
 const original=`[root](${folder}/README.md)`;writeFileSync(resolve(folder,'docs/child.md'),original);
 let r=run();assert.equal(r.status,0,r.stderr);
 const manifest=JSON.parse(readFileSync(resolve(folder,'.local/review-manifest.json'),'utf8'));
 const file=manifest.files.find(f=>f.path==='docs/child.md');
 assert.equal(file.source_sha256,createHash('sha256').update(original).digest('hex'));
 const bytes=readFileSync(resolve(folder,'.local/review/docs/child.md'));
 assert.equal(file.sha256,createHash('sha256').update(bytes).digest('hex'));assert.notEqual(file.sha256,file.source_sha256);
 writeFileSync(resolve(folder,'.local/review/injected.txt'),'untracked');r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/Unexpected release file/);
}));
test('known private values and output symlinks stop export without copying source',()=>fixture((folder,run)=>{
 writeFileSync(resolve(folder,'.env.local'),'SERVICE_ROLE_KEY=fictional-private-value-for-test\n');
 writeFileSync(resolve(folder,'docs/private.md'),'fictional-private-value-for-test');
 let r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/Secret candidate/);assert.ok(!r.stderr.includes('fictional-private-value-for-test'));assert.equal(existsSync(resolve(folder,'.local/review')),false);
 rmSync(resolve(folder,'docs/private.md'));mkdirSync(resolve(folder,'.local'),{recursive:true});mkdirSync(resolve(folder,'untouched'));symlinkSync(resolve(folder,'untouched'),resolve(folder,'.local/review'));
 r=run();assert.notEqual(r.status,0);assert.match(r.stderr,/symlink refused/);assert.equal(existsSync(resolve(folder,'untouched/README.md')),false);
}));
test('JPEG application captures retain exact binary bytes and source hashes',()=>fixture((folder,run)=>{
 const image=Buffer.from([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,0x80,0xfe,0xff,0xd9]);
 writeFileSync(resolve(folder,'docs/real-capture.jpg'),image);
 const r=run();assert.equal(r.status,0,r.stderr);
 assert.ok(existsSync(resolve(folder,'.local/review/docs/real-capture.jpg')));
 assert.deepEqual(readFileSync(resolve(folder,'.local/review/docs/real-capture.jpg')),image);
 const manifest=JSON.parse(readFileSync(resolve(folder,'.local/review-manifest.json'),'utf8'));
 const file=manifest.files.find(f=>f.path==='docs/real-capture.jpg');
 assert.equal(file.source_sha256,createHash('sha256').update(image).digest('hex'));
 assert.equal(file.sha256,file.source_sha256);
}));
