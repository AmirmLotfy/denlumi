import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
import {mkdir,writeFile}from'node:fs/promises';
import{spawn}from'node:child_process';
import{once}from'node:events';
import{resolve}from'node:path';
export const OUT=resolve('.local/submission/motion');
const C={paper:'#f5f5f5',ink:'#1f1f1f',muted:'#4a5565',line:'#d4d4d4',action:'#e42b0c',danger:'#9f302f',white:'#ffffff'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const clamp=x=>Math.max(0,Math.min(1,x));const ease=x=>1-(1-clamp(x))**4;
const text=(x,y,s,size=40,fill=C.ink,weight=500,extra='')=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(s)}</text>`;
const lines=(x,y,a,size=76,fill=C.ink,gap=84)=>a.map((s,i)=>text(x,y+i*gap,s,size,fill,650,'letter-spacing="-3"')).join('');
const root=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><g font-family="Helvetica Neue,Helvetica,Arial,sans-serif">${body}</g></svg>`;
const rect=(x,y,w,h,fill,rx=0,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const mark=(x,y,color=C.ink,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})">${rect(0,0,58,58,color,10)}${text(8,45,'d.',46,color===C.ink?C.white:C.ink,750)}</g>`;
const frame=(body,dark=false)=>root(`${rect(0,0,1920,1080,dark?C.ink:C.paper)}${body}`);
const path=(d,color=C.ink,width=3,extra='')=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${extra}/>`;
function paths(t,{dark=false,outro=false}={}){
 const ink=dark?'#f5f5f5':C.ink,line=dark?'#6d6d6b':'#b8b8b5';
 const draw=ease((t-.7)/1.5);const join=ease((t-3.2)/1.2);const cx=1470,cy=485;const expand=outro?0:ease((t-8.7)/.82);
 let s=path(`M 1110 300 C 1300 300 1270 485 1435 485`,line,3,`stroke-dasharray="650" stroke-dashoffset="${650*(1-draw)}"`)+path(`M 1110 670 C 1300 670 1270 485 1435 485`,line,3,`stroke-dasharray="650" stroke-dashoffset="${650*(1-draw)}"`);
 for(const [y,n,detail]of[[300,'Maya',outro?'Report':'New concern'],[670,'Sam',outro?'Fresh retrieval':'Older view']]){
 s+=`<g opacity="${ease((t-.2)/.7)}">`+`<circle cx="1080" cy="${y}" r="44" fill="none" stroke="${ink}" stroke-width="2"/>`+text(1063,y+14,n[0],38,ink,600)+text(1000,y-83,n,32,ink,600)+text(1000,y+95,detail,28,dark?'#c9c9c5':C.muted,450)+`</g>`;
 }
 s=`<g opacity="${1-expand}">`+s+`</g>`;s+=`<g opacity="${ease((t-1.4)/.8)}" transform="translate(${18*(1-join)} 0)">`+rect(cx-40+(650-(cx-40))*expand,cy-104+(119-(cy-104))*expand,330+(1198-330)*expand,208+(832-208)*expand,dark?'#292928':'#ffffff',12*(1-expand),`stroke="${ink}" stroke-width="${2*(1-expand)}"`)+`<g opacity="${1-expand}">`+text(cx-7,cy-46,'Household',28,dark?'#c9c9c5':C.muted,450)+text(cx-7,cy+4,'Current',47,ink,650)+text(cx-7,cy+61,'record',47,ink,650)+`</g></g>`;
 const pulse=clamp((t-1.5)/2.3);if(pulse>0&&pulse<1){let u=pulse,v=1-u,x=v*v*v*1110+3*v*v*u*1300+3*v*u*u*1270+u*u*u*1435,y=v*v*v*300+3*v*v*u*300+3*v*u*u*485+u*u*u*485;s+=`<circle cx="${x}" cy="${y}" r="10" fill="${dark?C.white:C.action}"/>`;}
 return s;
}
export function introSvg(t){
 const phase=ease((t-4.7)/.65),expand=ease((t-8.7)/.82);let b='';
 b+=`<g opacity="${1-expand}">`+mark(88,59)+text(165,99,'denlumi',43,C.ink,700,'letter-spacing="-2"')+text(1320,93,'A shared-home coordination demo',26,C.muted)+`</g>`;
 b+=`<g opacity="${(1-phase)*(1-expand)}" transform="translate(0 ${28*(1-ease(t/.7))})">`+text(88,210,'When information changes,',30,C.muted,450)+lines(88,355,['Same home.','Different','updates.'],112,C.ink,118)+text(90,798,'One new concern. An older plan.',35,C.muted,450)+`</g>`;
 b+=`<g opacity="${phase*(1-expand)}" transform="translate(0 ${25*(1-phase)})">`+text(88,360,'Denlumi',154,C.ink,700,'letter-spacing="-8"')+lines(92,495,['One current','record.'],89,C.ink,99)+text(94,790,'Clear reports. Clearer handovers.',35,C.muted,450)+`</g>`;
 b+=paths(t);b+=`<g opacity="${expand}">`+rect(0,0,1920,106,C.ink)+mark(66,24,C.white,.8)+text(126,65,'denlumi',34,C.white,650,'letter-spacing="-1"')+text(1190,65,'Fictional Alexa-style demo · Local application',25,'#dfdfdb')+`</g>`;
 b+=path('M88 925H1832',C.line,2)+rect(0,958,1920,122,C.ink)+text(88,1047,'Illustrated concept · Fictional household',21,'#babbb6')+text(1450,1047,'Same home. Same update.',21,'#babbb6');
 return frame(b);
}
export function outroSvg(t){
 let b=mark(88,58,C.white)+text(165,99,'denlumi',43,C.white,700,'letter-spacing="-2"');
 const a=ease(t/.7);b+=`<g opacity="${a}" transform="translate(0 ${35*(1-a)})">`+text(88,238,'One current record.',33,'#c9c9c5',450)+lines(88,390,['Same home.','Same update.'],110,C.white,120)+text(94,708,'Inspect the code. Run the local demo.',33,'#c9c9c5',450)+text(94,775,'github.com/AmirmLotfy/denlumi',33,C.white,550)+`</g>`;
 b+=paths(t+.8,{dark:true,outro:true});b+=path('M88 925H1832','#626260',2)+text(88,1047,'Local demo · Fictional records · Practical review remains open',21,'#d4d4ce');
 return frame(b,true);
}
export const chapters=[
 {id:1,start:9.52,end:17.71,title:['Fictional.','Functional.'],detail:['Alexa-style browser simulation','Local Auth + PostgreSQL','Real HTTP MCP'],short:'Alexa-style simulation. Real local software.',crop:[300,0,1100,650]},
 {id:2,start:17.71,end:26,title:['One plan.','Two readers.'],detail:['Finn · newcomer dog','Nora · resident cat','Each person acknowledges.'],short:'One reviewed revision. Separate acknowledgments.',crop:[310,0,1050,570]},
 {id:3,start:26,end:31.54,title:['Check before','starting.'],detail:['Current household','Current plan','Protocol status'],short:'A server preflight precedes an explicit start.',crop:[310,280,1050,570]},
 {id:4,start:31.54,end:43.01,title:['A report','changes','the state.'],detail:['Actor → target','Uncertainty + timing','A person confirms.'],short:'Human confirmation pauses guidance.',crop:[320,320,1050,570]},
 {id:5,start:43.01,end:56,title:['Old view?','Refused.'],detail:['A fresh conversation reads','the current household record.','Bedrock remains blocked.'],short:'Fresh retrieval through real authenticated HTTP MCP.',crop:[680,260,740,570]},
 {id:6,start:56,end:63.45,title:['Private by','intention.'],detail:['History preserved.','Preview before sharing.','Nothing sent automatically.'],short:'A factual preview remains under owner control.',crop:[110,150,1240,620]},
 {id:7,start:63.45,end:73.31,title:['Stop.','Even offline.'],detail:['Stops software on this device.','Shared update waits.','No physical animal control.'],short:'Local stop now. Shared update after reconnection.',crop:[0,620,1440,380],danger:true},
 {id:8,start:73.31,end:85.44,title:['Every pairing.','Its own','context.'],detail:['Cat–cat · dog–dog','Both mixed newcomer routes','Single-pet care stands alone.'],short:'Each pairing keeps its own context.',crop:[300,0,1100,680]},
 {id:9,start:85.44,end:95.7,title:['Built locally.','Limits visible.'],detail:['Bedrock inference blocked.','Earlier speech checks: synthetic.','Qualified review remains open.'],short:'Working coordination software. Evidence limits stated.',crop:[950,0,460,850]},
];
function offlineDiagram(focus){
 const shift=focus?-210:0;
 return `<g transform="translate(${shift} 0)">`+text(830,250,'Local software',32,C.ink,600)+text(1470,250,'Shared record',32,C.ink,600)+`<circle cx="925" cy="385" r="74" fill="none" stroke="${C.danger}" stroke-width="4"/>`+rect(898,358,54,54,C.danger,3)+path('M1005 385H1185 M1280 385H1470','#8b8c87',4)+path('M1205 367L1225 402 M1240 367L1260 402',C.ink,4)+rect(1475,305,295,168,C.white,9,`stroke="${C.ink}" stroke-width="2"`)+text(1510,370,'Sync after',36,C.ink,600)+text(1510,420,'reconnection',36,C.ink,600)+text(815,540,'Stops on this device.',28,C.muted,450)+text(1452,540,'The shared update waits.',28,C.muted,450)+text(1050,660,'Explanatory illustration · local stop / sync boundary',25,C.muted,450)+`</g>`;
}
export function chapterSvg(c,focus=false){
 const titleColor=c.danger?C.danger:C.ink;
 let b=rect(0,0,1920,1080,C.paper)+rect(0,0,1920,106,C.ink)+mark(66,24,C.white,.8)+text(126,65,'denlumi',34,C.white,650,'letter-spacing="-1"')+text(1190,65,'Fictional Alexa-style demo · Local application',25,'#dfdfdb');
 if(!focus){b+=text(86,205,String(c.id).padStart(2,'0')+' / 09',27,C.muted,500)+lines(82,320,c.title,75,titleColor,84);let y=320+c.title.length*84+68;b+=c.detail.map((x,i)=>text(88,y+i*45,x,27,C.muted,450)).join('');b+=path('M88 846H470',C.line,2)+text(88,892,'Actual recorded application',24,C.muted,450);}
 else {b+=text(90,168,c.short,39,titleColor,600,'letter-spacing="-1"');}
 if(c.id===7)b+=offlineDiagram(focus)+text(focus?130:650,748,'Actual recorded application status',25,C.muted,450);
 if(c.id===5&&focus)b+=lines(95,330,['Fresh read.','Current record.'],81,C.ink,90)+text(100,610,'Real authenticated HTTP MCP',30,C.muted)+text(100,660,'Database-template answer',30,C.muted)+text(100,710,'Bedrock remains blocked.',30,C.muted);
 b+=rect(0,958,1920,122,C.ink)+rect(0,958,1920*(c.end/104),3,C.action)+text(88,1047,'Fictional records · demo_only',21,'#babbb6')+text(1450,1047,'No native Alexa connection',21,'#babbb6');return root(b);
}
export async function renderAssets(){
 await mkdir(OUT,{recursive:true});
 for(const c of chapters)for(const focus of[false,true]){const svg=chapterSvg(c,focus);await writeFile(`${OUT}/chapter-${c.id}-${focus?'focus':'split'}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${OUT}/chapter-${c.id}-${focus?'focus':'split'}.png`);}
 await writeFile(`${OUT}/intro.svg`,introSvg(6.5));await writeFile(`${OUT}/outro.svg`,outroSvg(5));
 for(const [name,svg]of[['intro-problem',introSvg(3)],['intro-brand',introSvg(7)],['outro',outroSvg(5)]])await sharp(Buffer.from(svg)).png().toFile(`${OUT}/${name}.png`);
 await writeFile(`${OUT}/chapters.json`,JSON.stringify(chapters,null,2));
}
export async function encodeSvg(name,fn,duration){
 const proc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','30','-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','fast','-crf','19','-pix_fmt','yuv420p','-t',String(duration),`${OUT}/${name}.mp4`],{stdio:['pipe','inherit','inherit']});
 const result=once(proc,'close');
 for(let i=0;i<Math.ceil(duration*30);i++){const png=await sharp(Buffer.from(fn(i/30))).png({compressionLevel:1}).toBuffer();if(!proc.stdin.write(png))await once(proc.stdin,'drain');}
 proc.stdin.end();const[code]=await result;if(code)throw Error(`SVG encode failed ${name} ${code}`);console.log(JSON.stringify({rendered:name,duration}));
}
if(process.argv[1]===new URL(import.meta.url).pathname){await renderAssets();if(!process.argv.includes('--preview')){await encodeSvg('intro',introSvg,9.52);await encodeSvg('outro',outroSvg,8.3);}}
