import { resolve, relative, dirname, sep } from 'node:path';

export function releasePaths(root, args) {
 let checkOnly=false, output=resolve(root,'.local/public-release');
 for(let i=0;i<args.length;i++) {
  if(args[i]==='--check')checkOnly=true;
  else if(args[i]==='--output' && args[i+1])output=resolve(root,args[++i]);
  else throw Error('Supported arguments: --check, --output .local/<candidate>');
 }
 const name=relative(resolve(root,'.local'),output);
 if(!name || name.startsWith('..') || name.includes(sep) || name==='.git')throw Error('Output must be one direct child of .local');
 return {checkOnly,output,manifestPath:output+'-manifest.json'};
}

export function sanitizePublication(text, path, root) {
 // Resolve workspace-absolute Markdown links relative to their containing file,
 // before redacting general filesystem references in historical prose/evidence.
 if(path.endsWith('.md')) {
  text=text.replace(/\[([^\]]+)\]\(<?([^\s)>]+)>?\)/g,(match,label,target)=>{
   if(/(?:^|\/)(?:AGENTS|CLAUDE)\.md$/.test(target))return `${label} (operator instructions omitted from this public snapshot)`;
   if(!target.startsWith(root+'/'))return match;
   return `[${label}](${relative(dirname(resolve(root,path)),target).split(sep).join('/')})`;
  });
 }
 if(/\.(?:md|json|tap)$/.test(path))text=text.replaceAll(root+'/','./').replaceAll(root,'<local-workspace>').replaceAll('/Users/frameless/','<local-home>/').replace(/arn:aws:[^\s"<>]*:\d{12}:[^\s"<>]*/g,'<redacted-account-resource-arn>');
 return text;
}
