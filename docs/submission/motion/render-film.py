"""Compose original SVG assets, real paced capture and continuous narration."""
from pathlib import Path
import subprocess,json,hashlib,re,sys
root=Path('.local/submission');out=root/'motion';out.mkdir(exist_ok=True)
def run(args):subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*args],check=True)
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)],text=True))
meta=json.loads((root/'paced-timeline.json').read_text());assert meta['status']=='PASS'
assert not any('/speech' in x['path']for x in meta['network'])
raw=root/'denlumi-paced.webm';offset=max(0,float(probe(raw)['format']['duration'])-meta['duration'])
chapters=json.loads((out/'chapters.json').read_text());clips=[out/'intro.mp4'];shots=[]
for c in chapters:
 start,end=c['start'],c['end'];mid=start+(end-start)*.50
 if c['id']==1:mid=start+(end-start)*.58
 for focus,a,b in [(False,start,mid),(True,mid,end)]:
  count=round(b*30)-round(a*30);duration=count/30
  dest=out/f'scene-{c["id"]}-{"focus"if focus else"split"}.mp4'
  if focus:
   x,y,w,h=c['crop']
   if c['id']==9:x,y,w,h=950,200,460,600
   vf=f'[0:v]crop={w}:{h}:{x}:{y},scale=1660:744:force_original_aspect_ratio=decrease,pad=1660:744:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fade=t=in:st=0:d=0.16[v];[1:v][v]overlay=x=130:y=198:shortest=1,format=yuv420p[out]'
  else:
   vf='[0:v]scale=1198:832,setsar=1,fade=t=in:st=0:d=0.24[v];[1:v][v]overlay=x=650:y=119:shortest=1,format=yuv420p[out]'
  actual_crop=[x,y,w,h] if focus else None
  if c['id']==7:
   actual_crop=[0,900,1440,100]
   width=1660 if focus else 1198;left=130 if focus else 650;top=780 if focus else 800
   vf=f'[0:v]crop=1440:100:0:900,scale={width}:-2,setsar=1[v];[1:v][v]overlay=x={left}:y={top}:shortest=1,format=yuv420p[out]'
  if c['id']==5 and focus:
   actual_crop=[950,240,460,700]
   vf='[0:v]crop=460:700:950:240,scale=498:758,setsar=1,fade=t=in:st=0:d=0.16[v];[1:v][v]overlay=x=1210:y=188:shortest=1,format=yuv420p[out]'
  if c['id']==1 and not focus:vf=vf.replace(',fade=t=in:st=0:d=0.24','')
  if c['id']==9 and focus:vf=vf.replace('[out]','[composed]')+f';[composed]fade=t=out:st={max(0,duration-.32)}:d=0.32:color=0x1f1f1f[out]'
  if '--reuse' not in sys.argv or f'--refresh={c["id"]}' in sys.argv or not dest.exists():
   run(['-ss',str(offset+a),'-i',str(raw),'-loop','1','-framerate','30','-i',str(out/f'chapter-{c["id"]}-{"focus"if focus else"split"}.png'),'-filter_complex_threads','1','-filter_complex',vf,'-map','[out]','-an','-frames:v',str(count),'-r','30','-c:v','libx264','-threads','2','-preset','fast','-crf','19','-pix_fmt','yuv420p',str(dest)])
  clips.append(dest);shots.append({'chapter':c['id'],'layout':'focus'if focus else'split','start':a,'end':b,'frames':count,'source_start':offset+a,'crop':actual_crop});print('Rendered chapter',c['id'],'focus'if focus else'split',flush=True)
clips.append(out/'outro.mp4');(out/'concat.txt').write_text(''.join("file '"+str(p.resolve()).replace("'","'\\''")+"'\n"for p in clips))
run(['-f','concat','-safe','0','-i',str(out/'concat.txt'),'-c','copy',str(out/'picture.mp4')])
# Burn the supplied English captions into a reserved caption strip; keep a separate selectable stream too.
output=root/'denlumi-submission-film.mp4'
subprocess.run(['python3','docs/submission/motion/prepare-captions.py'],check=True)
subprocess.run(['node','docs/submission/motion/finish-film.mjs'],check=True)
x=probe(output);e={'scope':'Local submission edit; upload remains paused','duration_seconds':float(x['format']['duration']),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'dimensions':[1920,1080],'fps':30,'svg_assets':'Original authored vector caregiver/current-record paths, intro, chapter frames and outro','narration_job':'00c88557-d7d9-491e-9c37-ed8c905231d9','narration_model':'seed_audio','voice':'Grady preset; General American direction','source_capture_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'source_capture_duration_seconds':meta['duration'],'capture_actions':len(meta['actions']),'maximum_action_clock_slip_seconds':max(x['actual']-x['planned']for x in meta['actions']),'source_initial_trim_seconds':offset,'shots':shots,'captions':'English burned into reserved strip plus selectable mov_text and supplied SRT/VTT','toolchain':{'svg_asset_sharp':'0.35.4','caption_sharp':subprocess.check_output(['node','-p',"require('sharp').versions.sharp"],text=True).strip(),'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],'capture_playwright':'1.63.0'},'limits':['Original explanatory SVG graphics are not application/provider outcome evidence','Actual fictional local HTTP calls, not human usability acceptance','No native Alexa, successful Bedrock inference or qualified practical review claimed','Automated transcript/metadata/visual checks do not establish human audible acceptance','YouTube upload paused; no external publication of replacement']}
(root/'submission-film-check.json').write_text(json.dumps(e,indent=2)+'\n');print(json.dumps({k:e[k]for k in['duration_seconds','bytes','sha256','maximum_action_clock_slip_seconds']},indent=2))
